// Fetch the JSON data from a server or a file
const jsonData = {
  "name": "John",
  "age": 30,
  "address": {
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zip": "12345"
  },
  "prop1": {
    "prop2": {
      "prop3": {
        "prop4": {
          "prop5": {
            "prop6": {
              "prop7": {
                "prop8": {
                  "prop9": {
                    "prop10": "value"
                  }
                }
              }
            }
          }
        }
      },
      "array": [
        "val1",
        "val2"
      ]
    }
  }
};

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
function renderData(element, data) {
  element.innerHTML = '';
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];
      const li = document.createElement('li');
      const label = document.createElement('label');
      label.textContent = key;
      li.appendChild(label);
      if (typeof value === 'object') {
        const ul = document.createElement('ul');
        renderData(ul, value);
        li.appendChild(ul);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = stringifyValue(value);
        li.appendChild(input);
      }
      element.appendChild(li);
    }
  }
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
  if (!textAreaDeleted) {
    screen = parseValue(jsonDataTextArea.value);
  }
  const msg = {
      type: SDAP_MESSAGE_TYPE.CREATE,
      schema: {
          "$schema": "http://json-schema.org/draft-04/schema#",
          "type": "any"
      },
      value: screen
  };
  
  roomName = roomNameInput.value;
  if (roomName != "") {
    msg.name = roomName;
  }

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
  screen = created.value;
  loadEditor(screen);
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
  loadEditor(screen);
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
            loadEditor(screen);
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

var textAreaDeleted = false;
var oldRootElement = null, rootElement = null;

function loadEditor(data) {
  // Hide the button
  editButton.style.display = 'none';
  textAreaDeleted = true;
  
  // Create a tree structure of nested lists and input fields
  if (rootElement) {
    rootElement.innerHTML = '';
    var oldRootElement = rootElement;
  }
  rootElement = document.createElement('ul');
  renderData(rootElement, data);

  // Replace the text area with the tree structure
  if (oldRootElement) {
    oldRootElement.replaceWith(rootElement);
  } else {
    jsonDataTextArea.replaceWith(rootElement);
  }
  
  // Attach event listeners to the input fields
  const inputs = rootElement.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      console.log("Changed something");
      // Update the corresponding property in the JavaScript object
      const path = getPath(input);
      const value = parseValue(input.value);
      setProperty(screen, path, value);

      // Call the callback function with the JSON Pointer
      const pointer = getPointer(path);
      const ops = {};
      ops[pointer] = {
        type: "set",
        value: value
      }
      updateRoom(roomName, {"ops": ops});
    });
  });
}

function uiConfigure() {
  if (!socket) {
      return;
  }

  // When the user clicks the edit button, enter editing mode
  if (editButton) {
    editButton.addEventListener('click', () => {
      // Parse the JSON data into a JavaScript object
      const data = JSON.parse(jsonDataTextArea.value);

      loadEditor(data);
    });
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

  jsonDataTextArea      = document.getElementById('json-data');
  editButton            = document.getElementById('edit-button');

  // Set the initial JSON data in the text area
  screen = jsonData;
  jsonDataTextArea.value = JSON.stringify(jsonData, null, 2);
  jsonDataTextArea.style.height = "";jsonDataTextArea.style.height = jsonDataTextArea.scrollHeight + "px";

  // Configure WS Connection
  wsConfigure();

  // Configure UI
  uiConfigure();
}

