// Self-Described Aggregation Protocol
const SDAP_MESSAGE_TYPE = {
  HELLO:       'hello',
  CREATE:      'create',
  GET:         'get',
  UPDATE:      'update',
  SUBSCRIBE:   'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  CHANGES:     'changes'
}
  
/* Rendering functions */

// Renders a JavaScript object as a tree structure of nested lists and input fields
function renderData(data) {
  jsonVisualizerContent.value = JSON.stringify(data, null, 2);
  jsonVisualizerContent.style.height = "";jsonVisualizerContent.style.height = jsonVisualizerContent.scrollHeight + "px";
}
  
// Returns the path of an input field as an array of property names
function getPath(input) {
  const path = [];
  let currentElement = input.parentElement;
  while (currentElement !== null) {
    if (currentElement.tagName === 'LI') {
      const label = currentElement.querySelector('label');
      path.unshift(label.textContent);
    }
    currentElement = currentElement.parentElement;
  }
  return path;
}

// Sets a property of a JavaScript object identified by a path
function setProperty(obj, path, value) {
  let currentObj = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    console.log(key)
    currentObj = currentObj[key];
  }
  const lastKey = path[path.length - 1];
  currentObj[lastKey] = value;
}

// Converts a JavaScript value to a string for display in an input field
function stringifyValue(value) {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  } else {
    return value.toString();
  }
}

// Converts a string entered in an input field to a JavaScript value
function parseValue(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

// Returns the JSON Pointer string that identifies a property by its path
function getPointer(path) {
  return '/' + path.map(encodeURIComponent).join('/');
}

/* WebSockets */
const WEBSOCKETS_SERVER = "ws://localhost:9000";

const LAST_CHANGES_ARR_SIZE = 200;

/* WebSockets */
var socket = null;

const CHANGE_TYPE = {
  OWN:    "own",
  OTHERS: "others"
};

var appliedChanges = [];
for (let i = 0; i < LAST_CHANGES_ARR_SIZE; i++) {
  appliedChanges.push(undefined);
}
var nextChangeIdx = 0;
var lastChangeId = undefined;
var lastChangeAt = undefined;

function _updateLastChange(change) {
  appliedChanges[nextChangeIdx] = change;
  nextChangeIdx = (nextChangeIdx + 1) % LAST_CHANGES_ARR_SIZE;
  lastChangeId = change.changeId;
  lastChangeAt = change.changeAt;
}

/* Websockets communication */

function wsConfigure() {
  // Create WebSocket connection.
  socket = new WebSocket(WEBSOCKETS_SERVER);

  if (!socket) {
      console.log("Could not connect to " + WEBSOCKETS_SERVER);
      return;
  }

  // Connection opened
  socket.addEventListener('open', (event) => {
      console.log("Connected to server");
      hello();
  });

  // Listen for messages
  socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      console.log('Message from server', data);
      switch(data.type) {
          case SDAP_MESSAGE_TYPE.HELLO:
              helloed(data);
              break;
          case SDAP_MESSAGE_TYPE.CREATE:
              roomCreated(data);
              break;
          case SDAP_MESSAGE_TYPE.GET:
              roomAcquired(data);
              break;
          case SDAP_MESSAGE_TYPE.UPDATE:
              roomUpdated(data);
              break;
          case SDAP_MESSAGE_TYPE.SUBSCRIBE:
              subscribed(data);
              break;
          case SDAP_MESSAGE_TYPE.UNSUBSCRIBE:
              unsubscribed(data);
              break;
          case SDAP_MESSAGE_TYPE.CHANGES:
              roomChanged(data);
              break;
      }
  });
}

////////////////////
// HELLO
////////////////////

function hello() {
  console.log("Hello");
  const msg = {
      type: SDAP_MESSAGE_TYPE.HELLO,
      username: "anonymous"
  };
  socket.send(JSON.stringify(msg));
}

function helloed(data) {
  console.log("Helloed from server");
  console.log("Username is " + data.newUsername);
}

////////////////////
// CREATE
////////////////////

function createRoom() {
  console.log("Creating room");
  if (roomName) {
      // unsubscribe
      unsubscribeToRoomChanges(roomName);
  }
  const msg = {
      type: SDAP_MESSAGE_TYPE.CREATE,
      schema: {
          "$schema": "http://json-schema.org/draft-04/schema#",
          "type": "any"
      },
      value: screen
  };
  socket.send(JSON.stringify(msg));
}

function roomCreated(data) {
  const created = data.created;
  roomName = created.name;
  console.log("Room " + roomName)
  if (roomName) {
      roomNameInput.value = roomName;
  }
  console.log(`Room with name '${roomName}' created successfully.`);
  subscribeToRoomChanges(roomName);
}

////////////////////
// GET
////////////////////

function getRoom(name) {
  console.log(`Getting value for room name '${name}'`);
  const msg = {
      type: SDAP_MESSAGE_TYPE.GET,
      name: roomName
  };
  socket.send(JSON.stringify(msg));
}

function roomAcquired(data) {
  const room = data.value;
  console.log(`Received room name '${data.name}'`);
  console.log("Room:");
  console.log(room);
  lastChangeId = data.lastChangeId;
  lastChangeAt = data.lastChangeAt;
  screen = room;
  renderData(screen);
}

////////////////////
// UPDATE
////////////////////

function updateRoom(name, update) {
  console.log(`Updating room name '${name}'`);
  const msg = {
      type:    SDAP_MESSAGE_TYPE.UPDATE,
      name:    roomName,
      updates: [
          update
      ]
  };
  socket.send(JSON.stringify(msg));
}

function roomUpdated(data) {
  if (data.name == roomName) {
      console.log(`Room name '${data.name}' was updated`);
      console.log("Update results:");
      console.log(data.results);
      if (data.results) {
          for (let result of data.results) {
              const change = {
                  type: CHANGE_TYPE.OWN,
                  changeId: result.changeId,
                  changeTime: result.change
              };
              _updateLastChange(change);
          }
      }
  }
}

////////////////////
// SUBSCRIBE
////////////////////

function subscribeToRoomChanges(name) {
  console.log(`Subscribing to changes on room name '${name}'`);
  const msg = {
      type: SDAP_MESSAGE_TYPE.SUBSCRIBE,
      name: roomName
  };
  socket.send(JSON.stringify(msg));
}

function subscribed(data) {
  if (data.success) {
      console.log(`Subscribed successfully to changes on room name '${data.name}'`)
  }
}

////////////////////
// UNSUBSCRIBE
////////////////////

function unsubscribeToRoomChanges(name) {
  console.log(`Unsubscribing to changes on room name '${name}'`);
  const msg = {
      type: SDAP_MESSAGE_TYPE.UNSUBSCRIBE,
      name: roomName
  };
  socket.send(JSON.stringify(msg));
}

function unsubscribed(data) {
  if (data.success) {
      console.log(`Unsubscribed successfully to changes on room name '${data.name}'`)
  }
}

////////////////////
// CHANGES
////////////////////

function roomChanged(data) {
  const changes = data.changes;
  console.log(`Received changes from room name '${data.name}'`);
  console.log("Changes:");
  console.log(changes);
  for (const change of changes) {
      const ops = change.ops;
      for (const ptr in ops) {
          const op = ops[ptr];
          if (op.type == 'set') { // Only supported right now
            const path = ptr.split("/").slice(1);
            setProperty(screen, path, op.value);
            renderData(screen);
          }
      }

      const ch = {
          type: CHANGE_TYPE.OTHERS,
          changeId: change.changeId,
          changeTime: change.change,
          change: change
      };
      _updateLastChange(ch);
  }
}

////////////////////
// OTHERS
////////////////////

function joinRoom() {
  if (!roomNameInput) {
      console.log('Cannot find room name input');
      return;
  }

  if (roomName) {
      unsubscribeToRoomChanges(roomName);
  }

  roomName = roomNameInput.value;
  console.log(`Joining room name '${roomName}'`);
  getRoom(roomName);
  subscribeToRoomChanges(roomName);
}

/* Buttons and inputs */
var createRoomBtn = null, joinRoomBtn = null, roomNameInput = null;
var roomName = null;

/* Live data */
var screen;

/* UI */

function uiConfigure() {
  if (!socket) {
      return;
  }
  
  if (createRoomBtn) {
      createRoomBtn.addEventListener('click', (event) => {
          createRoom();
      });
  }
  
  if (joinRoomBtn) {
      joinRoomBtn.addEventListener('click', (event) => {
          joinRoom();
      });
  }
}

window.onload = function() {
  onLoad();
};

function onLoad() {
  // Get the HTML elements
  // Buttons and Inputs
  createRoomBtn = document.getElementById("createRoom");
  joinRoomBtn   = document.getElementById("joinRoom");
  roomNameInput   = document.getElementById("roomName");

  // Get the HTML elements
  jsonVisualizerContent = document.getElementById('json-visualizer-content');

  // Configure WS Connection
  wsConfigure();

  // Configure UI
  uiConfigure();
}


