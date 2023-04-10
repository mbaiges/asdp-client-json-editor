// Fetch the JSON data from a server or a file
const jsonData = {
  "string": "hello",
  "number": 42,
  "boolean": true,
  "array": [1, 2, 3],
  "object": {
    "key": "value"
  }
};

const jsonSchema = {
  "type": "object",
  "properties": {
    "string": {
      "type": "string"
    },
    "number": {
      "type": "number"
    },
    "boolean": {
      "type": "boolean"
    },
    "array": {
      "type": "array",
      "items": {
        "type": "number"
      }
    },
    "object": {
      "type": "object",
      "properties": {
        "key": {
          "type": "string"
        }
      }
    }
  }
};

// Self-Described Aggregation Protocol

const SDAP_MESSAGE_TYPE = {
  HELLO:       'hello',
  CREATE:      'create',
  GET:         'get',
  SCHEMA:      'schema',
  UPDATE:      'update',
  SUBSCRIBE:   'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  CHANGES:     'changes'
}
  
/* Rendering functions */

// Renders a JavaScript object as a tree structure of nested lists and input fields
function renderData(element, schema, data, current_path) {
  element.innerHTML = '';
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];
      const li = document.createElement('li');
      const label = document.createElement('label');
      label.textContent = key;
      li.appendChild(label);

      current_path.push(key); // Adds to context
      if (typeof value === 'object') {
        const ul = document.createElement('ul');
        renderData(ul, schema, value, current_path);
        li.appendChild(ul);
      } else {
        const ptr = getPointer(current_path);
        const s = traverseSchema(schema, ptr);

        let e;
        switch(s.type) {
          case 'string':
            e = document.createElement('input');
            e.type = 'text';
            e.value = stringifyValue(value);
            break;
          case 'number':
            e = document.createElement('input');
            e.type = 'number';
            e.step = 0.001;
            e.value = stringifyValue(value);
            break;
          case 'boolean':
            e = document.createElement('select');
            const optionTrue = document.createElement('option');
            optionTrue.innerHTML = 'true';
            const optionFalse = document.createElement('option');
            optionFalse.innerHTML = 'false';
            e.appendChild(optionTrue);
            e.appendChild(optionFalse);
            v = stringifyValue(value);
            if (v === 'true') {
              optionTrue.selected = true;
            } else if (v === 'false') {
              optionFalse.selected = false;
            }
            break;
        }
        e.classList.add("customInput");
        li.appendChild(e);
      }
      current_path.pop(); // removes from context
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

// Traverses the schema using the pointer
function traverseSchema(s, pointer) {
  let segments = pointer.split("/").slice(1);
  let currSchema = s;

  for (let segment of segments) {
    segment = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    // If schema does not exist
    if (!schema) {
      return undefined;
    }
    // If the current schema is an object, access its property
    else if (currSchema.type === "object") {
      currSchema = currSchema.properties[segment];
    }
    // If the current schema is an array, access its items
    else if (currSchema.type === "array") {
      currSchema = currSchema.items;
    }
    // pointer is invalid
    else {
      return undefined;
    }
  }

  return currSchema;
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
          case SDAP_MESSAGE_TYPE.SCHEMA:
            roomSchemaAcquired(data);
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
    schema = parseValue(jsonSchemaTextArea.value);
    screen = parseValue(jsonDataTextArea.value);
  }
  const msg = {
      type: SDAP_MESSAGE_TYPE.CREATE,
      schema: schema,
      value: screen
  };
  
  roomName = roomNameInput.value;
  if (roomName != "") {
    msg.name = roomName;
  }

  socket.send(JSON.stringify(msg));
}

function roomCreated(data) {
  if (data.status !== 201) {
    msg = "";
    if ('errors' in data) {
      for (let e of data.errors) {
        if (msg !== "") {
          msg += '\n';
        }
        let m = e.msg ? e.msg : "";
        const regex = /[0-9]: instance/i;
        m = m.replace(regex, "");
        m = m.replace(".", "/");
        msg += `[${e.code}] ${m}`;
      }
    }
    errorsSpan.innerHTML = msg;
    return;
  }
  errorsSpan.innerHTML = '';

  const created = data.created;
  roomName = created.name;
  console.log("Room " + roomName)
  if (roomName) {
      roomNameInput.value = roomName;
  }
  console.log(`Room with name '${roomName}' created successfully.`);
  subscribeToRoomChanges(roomName);
  schema = created.schema;
  screen = created.value;
  roomJoined = true;
  loadEditor(schema, screen);
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
  roomJoined = true;
  loadEditor(schema, screen);
}

////////////////////
// SCHEMA
////////////////////

function getRoomSchema(name) {
  console.log(`Getting schema for room name '${name}'`);
  const msg = {
      type: SDAP_MESSAGE_TYPE.SCHEMA,
      name: roomName
  };
  socket.send(JSON.stringify(msg));
}

function roomSchemaAcquired(data) {
  schema = data.schema;
  console.log(`Received room schema name '${data.name}'`);
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
      if (data.status !== 200) {
        msg = "";
        for (let r of data.results) {
          if ('errors' in r) {
            for (let e of r.errors) {
              if (msg !== "") {
                msg += '\n';
              }
              let m = e.msg ? e.msg : "";
              const regex = /[0-9]: instance/i;
              m = m.replace(regex, "");
              m = m.replaceAll(".", "/");
              msg += `[${e.code}] ${m}`;
            }
          }
        }
        errorsSpan.innerHTML = msg;
        return;
      }
      errorsSpan.innerHTML = '';
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
            loadEditor(schema, screen);
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
  getRoomSchema(roomName);
  getRoom(roomName);
  subscribeToRoomChanges(roomName);
}

/* Buttons and inputs */
var createRoomBtn = null, joinRoomBtn = null, roomNameInput = null;
var roomName = null;

/* Live data */
var screen;
var roomJoined = false;

/* UI */

var textAreaDeleted = false;
var oldRootElement = null, rootElement = null;

function loadEditor(schema, data) {
  // Hide the button
  editButton.style.display = 'none';
  textAreaDeleted = true;
  
  // Create a tree structure of nested lists and input fields
  if (rootElement) {
    rootElement.innerHTML = '';
    var oldRootElement = rootElement;
  }
  rootElement = document.createElement('ul');
  renderData(rootElement, schema, data, []);

  // Replace the text area with the tree structure
  if (oldRootElement) {
    oldRootElement.replaceWith(rootElement);
  } else {
    editors.replaceWith(rootElement);
  }
  
  // Attach event listeners to the input fields
  const inputs = rootElement.querySelectorAll('.customInput');
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      // Update the corresponding property in the JavaScript object
      const path = getPath(input);
      const value = parseValue(input.value);
      setProperty(screen, path, value);

      if (!roomJoined) {
        return; // If not joined, then everything is offline.
      }

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

// Schema infer
function inferSchema(json) {
  let schema = {};

  if (json === null) {
    schema.type = "null";
  } else if (typeof json === "string") {
    schema.type = "string";
  } else if (typeof json === "number") {
    schema.type = "number";
  } else if (typeof json === "boolean") {
    schema.type = "boolean";
  } else if (typeof json === "object") {
    // If it's an array
    if (Array.isArray(json)) {
      schema.type = "array";
      if (json.length > 0) {
        schema.items = inferSchema(json[0]);
      }
    // If it's an object
    } else {
      schema.type = "object";
      
      if (Object.keys(json).length !== 0) {
        schema.properties = {};
        for (let k in json) {
          schema.properties[k] = inferSchema(json[k]);
        }
      }
    }
  } else {
    schema.type = "null";
  }

  return schema;
}

function uiConfigure() {
  if (!socket) {
      return;
  }

  // When the user clicks the edit button, enter editing mode
  if (editButton) {
    editButton.addEventListener('click', () => {
      // Parse the JSON data into a JavaScript object
      schema = JSON.parse(jsonSchemaTextArea.value);
      const data = JSON.parse(jsonDataTextArea.value);
      screen = data;

      clickedOnEdit = true;

      loadEditor(schema, data);
    });
  }

  if (inferButton) {
    inferButton.addEventListener('click', () => {
      const data = JSON.parse(jsonDataTextArea.value);
      const s = inferSchema(data);
      jsonSchemaTextArea.value = JSON.stringify(s, null, 2);
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

  errorsSpan            = document.getElementById('errors');

  editors               = document.getElementById('editors');
  jsonSchemaTextArea    = document.getElementById('json-schema');
  jsonDataTextArea      = document.getElementById('json-data');
  inferButton           = document.getElementById('inferSchema');
  editButton            = document.getElementById('edit-button');

  // Set the initial JSON Schema and JSON data in the text area
  jsonSchemaTextArea.value = JSON.stringify(jsonSchema, null, 2);

  screen = jsonData;
  jsonDataTextArea.value = JSON.stringify(jsonData, null, 2);

  // Configure WS Connection
  wsConfigure();

  // Configure UI
  uiConfigure();
}

