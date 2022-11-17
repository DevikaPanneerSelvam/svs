var editor, graph, animation, demoCircuitListFiltered_data;
var VM;
var oldmainfolder, oldsubfolder;
// Set current user
function login(username) {
  model.is_public_acc(false);
  model.user(username);
  loadCircuitList();
  button_toggle();
  $('#txt-login-user').val("");
  $('#txt-login-pass').val("");
}

function login_public(username) {
  model.is_public_acc(true);
  $('#save-popup').hide();
  $('#btn-save-circuit').hide();
  $('#btn-delete').hide();
  model.user(username);
  loadCircuitList();
  button_toggle();
  $('#txt-login-user').val("");
  $('#txt-login-pass').val("");
}

function loginfailure() {
  model.user(null);
  $('#login-fail').modal('show');
}

// Clear current user
function logout() {
  model.user(null);
  loadCircuitList();
  button_toggle();
  clearCircuit();
}

// Get current user
function getCurrentUser(callback) {
  $.ajax({
    type: 'GET',
    url: 'user',
    dataType: 'json',
    success: function (data) {
      if(data.public_acc)
        login_public(data.user);
      else
        login(data.user);
      if (callback) callback(data);
    }
  });
}

// Load the circuit list
function loadCircuitList(callback) {
  $.ajax({
    type: 'GET',
    url: 'circuits',
    dataType: 'json',
    success: function (data) {
      model.circuitList(data.entries);

      //find the distinct main folders
      var main_folders = data.entries.map(item => item.main_folder)
        .filter((value, index, self) => self.indexOf(value) === index);

      var obj = [];
      var subfolderid = 0;
      //for each distinct main folder, find it sub folders and ckts and add to one obj
      var init_main = 0;
      for (let i = 0; i < main_folders.length; i++) {
        if (main_folders[i] != null) {
          const under_main_folder = data.entries.filter(d => d.main_folder === main_folders[i]);
          var dist_sub_folder = under_main_folder.map(item => item.sub_folder)
            .filter((value, index, self) => self.indexOf(value) === index);

          //for each distinct sub folder, find its rows and add to one obj
          var sub_obj = [];
          var init_sub = 0;
          for (let j = 0; j < dist_sub_folder.length; j++) {
            if (dist_sub_folder[j] != null && dist_sub_folder[j] != "") {
              const sub_folder_contents = under_main_folder.filter(d => d.sub_folder === dist_sub_folder[j]);

              sub_obj[init_sub] = {
                ["sub_folder_name"]: dist_sub_folder[j],
                ["sub_folder_id"]: subfolderid,
                ["sub_main_folder"]: main_folders[i],
                ["contents"]: sub_folder_contents
              }

              init_sub = init_sub + 1;
              subfolderid = subfolderid + 1;
            }
          }
          //now add the rows under the distinct main folder that do not have sub folder to sub_obj
          const direct_sub_ckts = under_main_folder.filter(d => d.sub_folder === null);

          obj[init_main] = {
            ["main_folder_name"]: main_folders[i],
            ["contents"]: sub_obj,
            ["circuits"]: direct_sub_ckts
          };
          init_main = init_main + 1;
        }
      }

      const directCkts = data.entries.filter(d => d.main_folder === null);

      var mainobj = [];
      mainobj[0] = {
        ["folder"]: obj,
        ["directcircuits"]: directCkts,
      };

      model.mycircuits(mainobj);
      if (callback) callback(obj);

      /* model.circuitList(data.entries);
      if (callback) callback(data); */
    }
  });
}

// Load the list of demo circuits
function loadDemoCircuitList(callback) {
  $.ajax({
    type: 'GET',
    url: 'demos',
    dataType: 'json',
    success: function (data) {
      model.demoCircuitList(data.entries);

      //find the distinct main folders
      var main_folders = data.entries.map(item => item.main_folder)
        .filter((value, index, self) => self.indexOf(value) === index);

      var obj = [];
      var subfolderid = 0;
      //for each distinct main folder, find it sub folders and ckts and add to one obj
      var init_main = 0;
      for (let i = 0; i < main_folders.length; i++) {
        if (main_folders[i] != null) {
          const under_main_folder = data.entries.filter(d => d.main_folder === main_folders[i]);
          var dist_sub_folder = under_main_folder.map(item => item.sub_folder)
            .filter((value, index, self) => self.indexOf(value) === index);

          //for each distinct sub folder, find its rows and add to one obj
          var sub_obj = [];
          var init_sub = 0;
          for (let j = 0; j < dist_sub_folder.length; j++) {
            if (dist_sub_folder[j] != null && dist_sub_folder[j] != "") {
              const sub_folder_contents = under_main_folder.filter(d => d.sub_folder === dist_sub_folder[j]);

              sub_obj[init_sub] = {
                ["sub_folder_name"]: dist_sub_folder[j],
                ["sub_folder_id_demo"]: subfolderid,
                ["contents"]: sub_folder_contents
              }
              debugger;
              init_sub = init_sub + 1;
              subfolderid = subfolderid + 1;
            }
          }
          //now add the rows under the distinct main folder that do not have sub folder to sub_obj
          const direct_sub_ckts = under_main_folder.filter(d => d.sub_folder === null);

          obj[init_main] = {
            ["main_folder_name"]: main_folders[i],
            ["contents"]: sub_obj,
            ["circuits"]: direct_sub_ckts
          };
          init_main = init_main + 1;
        }
      }

      const directCkts = data.entries.filter(d => d.main_folder === null);

      var mainobj = [];
      mainobj[0] = {
        ["folder"]: obj,
        ["directcircuits"]: directCkts,
      };

      model.demo(mainobj);

      if (callback) callback(obj);
    }
  });
}

function FetchMainFolderNamesForko(demoCircuitListFiltered_data) {
  var dist_main_folders = demoCircuitListFiltered_data.map(item => item.main_folder)
    .filter((value, index, self) => self.indexOf(value) === index);

  var j = 0;
  var obj = [];
  for (var i = 0; i < dist_main_folders.length; i++) {
    if (dist_main_folders[i] != null) {
      var insidenode = [];
      insidenode[0] = {
        ["sub_folder_name"]: dist_main_folders[i],
      }

      const nextNode = {
        ["main_folder_name"]: dist_main_folders[i],
        ["contents"]: insidenode,
      }
      obj[j] = nextNode;
      j++;
    }
  }
  model.folder(obj);
}

function FolderModel() {
  var self = this;
  self.dist_main_folders = ko.observableArray([]);

  self.GetMainFolders = function (name) {
    this.dist_main_folders.push(new MainFolder(name));
  };

}

function GetSubFolders(data, event) {
  var dist_main_folders = demoCircuitListFiltered_data.map(item => item.main_folder)
    .filter((value, index, self) => self.indexOf(value) === index);

  var j = 0;
  obj = [];
  for (var i = 0; i < dist_main_folders.length; i++) {
    if (dist_main_folders[i] != null) {
      const nextNode = {
        ["sub_folder_name"]: dist_main_folders[i]
      }
      obj[j] = nextNode;
      j++;
    }
  }
  model.demoSubFoldersList(obj);
}

function MainFolder(name) {
  var self = this;

  self.main_folder_name = ko.observable(name);
  self.sub_folders = ko.observableArray([]);

  self.GetSubFolders = function (data, event) {
    data.sub_folders([]);
    var dist_sub_folder;

    /*     const under_main_folder = demoCircuitListFiltered_data.filter(d => d.main_folder === self.main_folder_name);
        data.sub_folders = under_main_folder.map(item => item.sub_folder)
              .filter((value, index, self) => self.indexOf(value) === index); */

    /*     $(dist_sub_folder).each(function (index, sub_folder){
          data.sub_folders.push(new SubFolder(dist_sub_folder[index].sub_folder));
        }); */
  };
}

function SubFolder(name) {
  var self = this;

  self.sub_folder_name = ko.observable(name);
  self.sub_circuits = ko.observableArray([]);
}

function Sub_Circuits(name) {
  var self = this;

  self.ckts = ko.observableArray([]);
}

// Load an empty circuit and clear graph + animation view.
function clearCircuit() {
  var data = {
    title: '(untitled circuit)',
    description: '',
    netlist: '(untitled circuit)\n* version: 3.0.0\n.end\n',
    is_public: false,
  };
  model.circuit(new CircuitViewModel(data)); // Load empty circuit in circuit view.
  editor.load(model.circuit().parsedNetlist); // Load empty circuit in editor view.

  // Clear graph view.
  graph.layer.clear();
  graph.overlay.clear();
  graph.traces = [];
  model.traces(graph.traces);
  graph.traces_graph = [];
  model.traces_graph(graph.traces_graph);
  // Clear animation view.
  animation.layer.clear();
}

// Save the current circuit
function saveCircuit(callback) {
  //var c = model.circuit();
  model.circuit().netlist(svs.spice.writeNetlist(model.circuit().parsedNetlist));
  var c = model.circuit();
  if (!c) return;
  var id = c.circuit.id;
  var data = {
    'title': c.title(),
    'netlist': c.netlist(),
    'description': c.description(),
    'is_public': c.is_public()
  };
  var onSuccess = function (data) {
    // Trigger refresh of circuit list an demos (TODO only if this is the demo user).
    loadCircuitList();
    loadDemoCircuitList();
    loadCircuit(id ? 'circuits/' + id : 'circuits/' + data.id);
    if (callback) callback(data);
  };
  var onError = function (jqxhr, textStatus, error) {
    if (error.toLowerCase() === 'conflict') {
      alert('A circuit with this name already exists. Please choose another one.');
    }
  };
  if (!id) {
    // Create a new circuit
    $.ajax({
      type: 'POST',
      url: 'circuits',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: onSuccess,
      error: onError
    });
  } else {
    $.ajax({
      type: 'PUT',
      url: 'circuits/' + id,
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: onSuccess,
      error: onError
    });
  }
}

// Delete the current circuit
function deleteCircuit(callback) {
  var c = model.circuit();
  if (!c) return;
  var id = c.circuit.id;
  if (!id) return;
  // TODO ask for confirmation
  var onSuccess = function (data) {
    loadCircuitList();
    loadDemoCircuitList();
    if (callback) callback(data);
  };
  $.ajax({
    type: 'DELETE',
    url: 'circuits/' + id,
    success: onSuccess
  });
}

// Send the current netlist to the server for simulation
function simulateNetlist(callback) {
  var netlist = model.circuit().parsedNetlist;
  $.ajax({
    type: 'POST',
    url: 'spice',
    data: svs.spice.writeNetlist(netlist),
    contentType: 'text/plain',
    processData: false,
    success: function (data) {
      var output = svs.spice.readOutput(data);
      graph.load(output);
      model.traces(graph.traces);
      model.traces_graph(graph.traces_graph);
      model.animationPlaybackSpeed(1.0);
      svs.canvas.setSpeed(1.0);
      animation.load(netlist, output);
      model.animationReady(true);
      model.animationRunning(true);
      if (callback) callback(data);
    }
  });
}

function sidemenufolder(folder_name, level) {
  if (level == "main") {
    model.configure_folder.mainfoldername(folder_name);
    oldmainfolder = folder_name;
    $('#edit-main-folder').modal('show');
    $('#configure-main-success').hide();
    $('#configure-main-error').hide();
    $('#configure-main-folder-error').hide();
  }
  else if (level == "sub") {
    arrfolder = folder_name.split(",");
    model.configure_folder.subfoldername(arrfolder[0]);
    model.configure_folder.mainfoldername(arrfolder[1]);

    oldsubfolder = arrfolder[0];
    oldmainfolder = arrfolder[1];
    $('#edit-sub-folder').modal('show');
    $('#configure-sub-success').hide();
    $('#configure-sub-error').hide();
    $('#configure-sub-folder-error').hide();
  }

  /* if(user == "demos"){
    $('#btn-edit-folder').hide();
  }
  else if(user == "myckts"){
    $('#btn-edit-folder').show();
  } */
}

function EditFolder(level) {
  if (level == "sub") {
    if (model.configure_folder.subfoldername() == "") {
      model.configure_folder.subfoldername(null);
    }
    var data = { 'old_sub_folder_name': oldsubfolder, 'level': level, 'old_main_folder_name': oldmainfolder, 'new_sub_folder_name': model.configure_folder.subfoldername() };
  }
  else if (level == "main") {
    if (model.configure_folder.mainfoldername() == "") {
      model.configure_folder.mainfoldername(null);
    }
    var data = { 'old_main_folder_name': oldmainfolder, 'level': level, 'new_main_folder_name': model.configure_folder.mainfoldername() };
  }

  //consider if there is a sub folder while editing the main folder name, i mean when u try to empty the main folder name.
  $.ajax({
    type: 'POST',
    url: 'editfolder',
    contentType: 'application/json',
    data: JSON.stringify(data),
    success: function () {
      model.configure_folder.mainError(null);
      model.configure_folder.subError(null);
      loadCircuitList();
      if (level == "sub") {
        $('#configure-sub-success').show();
      }
      else {
        $('#configure-main-success').show();
      }
    },
    error: function (jqxhr, textStatus, error) {
      try {
        errors = JSON.parse(jqxhr.responseText);
      } catch (SyntaxError) {
        errors = { "fatal": "There was an internal error." }
      }
      if (errors.fatal) {
      }
      else {
        if (level == "sub") {
          model.configure_folder.subError("Error in editing sub folder name");
          $('#configure-sub-error').show();
        }
        else {
          model.configure_folder.mainError("Error in editing main folder name");
          $('#configure-main-error').show();
        }
      }
    }
  });
}

// Configure main folder name
function ConfigureFolder(callbackSuccess, callbackError) {
  debugger;
  if (model.configure_folder.mainfoldername() == "") {
    model.configure_folder.mainfoldername(null);
  }
  if (model.configure_folder.subfoldername() == "") {
    model.configure_folder.subfoldername(null);
  }
  var data = { 'cktid': model.configure_folder.cktid(), 'main_folder_name': model.configure_folder.mainfoldername(), 'sub_folder_name': model.configure_folder.subfoldername() };
  debugger;
  $.ajax({
    type: 'POST',
    url: 'configurefolder',
    contentType: 'application/json',
    data: JSON.stringify(data),
    success: function () {
      model.configure_folder.mainError(null);
      model.configure_folder.subError(null);
      loadCircuitList();
      if (callbackSuccess) callbackSuccess();
    },
    error: function (jqxhr, textStatus, error) {
      try {
        errors = JSON.parse(jqxhr.responseText);
      } catch (SyntaxError) {
        errors = { "fatal": "There was an internal error." }
      }
      if (errors.fatal) {
        if (callbackError) callbackError();
      }
      else {
        model.configure_folder.mainError(errors.name);
        model.configure_folder.subError(errors.email);
      }
    }
  });

}

// Create a new account
function signUp(callbackSuccess, callbackError) {
  var data = { 'name': model.signup.name(), 'email': model.signup.email(), 'is_public':model.signup.is_public() };
  $.ajax({
    type: 'POST',
    url: 'signup',
    contentType: 'application/json',
    data: JSON.stringify(data),
    success: function () {
      model.signup.nameError(null);
      model.signup.emailError(null);
      if (callbackSuccess) callbackSuccess();
    },
    error: function (jqxhr, textStatus, error) {
      try {
        errors = JSON.parse(jqxhr.responseText);
      } catch (SyntaxError) {
        errors = { "fatal": "There was an internal error." }
      }
      if (errors.fatal) {
        if (callbackError) callbackError();
        model.signup.emailError(errors.fatal);
      }
      else {
        model.signup.nameError(errors.name);
        model.signup.emailError(errors.email);
      }
    }
  });

}

function forgot(callbackSuccess, callbackError) {
  var data = { 'email': model.forgot.email() };
  $.ajax({
    type: 'POST',
    url: 'forgotpass',
    contentType: 'application/json',
    data: JSON.stringify(data),
    success: function () {
      model.forgot.emailError(null);
      if (callbackSuccess) callbackSuccess();
    },
    error: function (jqxhr, textStatus, error) {
      try {
        errors = JSON.parse(jqxhr.responseText);
      } catch (SyntaxError) {
        errors = { "fatal": "There was an internal error." }
      }
      if (errors.fatal) {
        model.forgot.fatalError(errors.fatal);
        if (callbackError) callbackError();
      }
      else {
        model.forgot.emailError(errors.email);
      }
    }
  });
}

function changepass(callbackSuccess, callbackError) {
  var data = { 'oldpass': model.change.oldpass(), 'newpass': model.change.newpass(), 'newpassconfirm': model.change.newpassconfirm() };
  $.ajax({
    type: 'POST',
    url: 'changepass',
    contentType: 'application/json',
    data: JSON.stringify(data),
    success: function () {
      model.change.oldpassError(null);
      model.change.newpassError(null);
      model.change.newpassconfirmError(null);
      model.change.oldpass(null);
      model.change.newpass(null);
      model.change.newpassconfirm(null);

      if (callbackSuccess) callbackSuccess();
    },
    error: function (jqxhr, textStatus, error) {
      try {
        errors = JSON.parse(jqxhr.responseText);
      } catch (SyntaxError) {
        errors = { "fatal": "There was an internal error." }
      }
      if (errors.fatal) {
        model.change.fatalError(errors.fatal);
        if (callbackError) callbackError(); var editor, graph, animation;

        // Set current user
        function login(username) {
          model.user(username);
          loadCircuitList();
          button_toggle();
          $('#txt-login-user').val("");
          $('#txt-login-pass').val("");
        }

        function loginfailure() {
          model.user(null);
          $('#login-fail').modal('show');
        }

        // Clear current user
        function logout() {
          model.user(null);
          loadCircuitList();
          button_toggle();
        }

        // Get current user
        function getCurrentUser(callback) {
          $.ajax({
            type: 'GET',
            url: 'user',
            dataType: 'json',
            success: function (data) {
              login(data.user);
              if (callback) callback(data);
            }
          });
        }

        // Load the circuit list
        function loadCircuitList(callback) {
          $.ajax({
            type: 'GET',
            url: 'circuits',
            dataType: 'json',
            success: function (data) {
              model.circuitList(data.entries);
              if (callback) callback(data);
            }
          });
        }

        // Load the list of demo circuits
        function loadDemoCircuitList(callback) {
          $.ajax({
            type: 'GET',
            url: 'demos',
            dataType: 'json',
            success: function (data) {
              model.demoCircuitList(data.entries);
              if (callback) callback(data);
            }
          });
        }

        // Load an empty circuit
        // TODO stop/clear animation/graph?
        function clearCircuit() {
          var data = {
            title: '(untitled circuit)',
            description: '',
            netlist: '(untitled circuit)\n* version: 3.0.0\n.end\n',
            is_public: false,
          };
          model.circuit(new CircuitViewModel(data));
          editor.load(model.circuit().parsedNetlist);
        }

        // Save the current circuit
        function saveCircuit(callback) {
          var c = model.circuit();
          if (!c) return;
          var id = c.circuit.id;
          var data = {
            'title': c.title(),
            'netlist': c.netlist(),
            'description': c.description(),
            'is_public': c.is_public()
          };
          var onSuccess = function (data) {
            // Trigger refresh of circuit list an demos (TODO only if this is the demo user).
            loadCircuitList();
            loadDemoCircuitList();
            loadCircuit(id ? 'circuits/' + id : 'circuits/' + data.id);
            if (callback) callback(data);
          };
          var onError = function (jqxhr, textStatus, error) {
            if (error.toLowerCase() === 'conflict') {
              alert('A circuit with this name already exists. Please choose another one.');
            }
          };
          if (!id) {
            // Create a new circuit
            $.ajax({
              type: 'POST',
              url: 'circuits',
              dataType: 'json',
              contentType: 'application/json',
              data: JSON.stringify(data),
              success: onSuccess,
              error: onError
            });
          }
          else {
            $.ajax({
              type: 'PUT',
              url: 'circuits/' + id,
              contentType: 'application/json',
              data: JSON.stringify(data),
              success: onSuccess,
              error: onError
            });
          }
        }

        // Delete the current circuit
        function deleteCircuit(callback) {
          var c = model.circuit();
          if (!c) return;
          var id = c.circuit.id;
          if (!id) return;
          // TODO ask for confirmation
          var onSuccess = function (data) {
            loadCircuitList();
            loadDemoCircuitList();
            if (callback) callback(data);
          };
          $.ajax({
            type: 'DELETE',
            url: 'circuits/' + id,
            success: onSuccess
          });
        }

        // Send the current netlist to the server for simulation
        function simulateNetlist(callback) {
          var netlist = model.circuit().parsedNetlist;
          $.ajax({
            type: 'POST',
            url: 'spice',
            data: svs.spice.writeNetlist(netlist),
            contentType: 'text/plain',
            processData: false,
            success: function (data) {
              var output = svs.spice.readOutput(data);
              graph.load(output);
              model.traces(graph.traces);
              model.traces_graph(graph.traces_graph);
              model.animationPlaybackSpeed(1.0);
              svs.canvas.setSpeed(1.0);
              animation.load(netlist, output);
              model.animationReady(true);
              model.animationRunning(true);
              if (callback) callback(data);
            }
          });
        }

        // Create a new account
        function signUp(callbackSuccess, callbackError) {
          var data = { 'name': model.signup.name(), 'email': model.signup.email(), 'is_public': model.signup.is_public() };
          $.ajax({
            type: 'POST',
            url: 'signup',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function () {
              model.signup.nameError(null);
              model.signup.emailError(null);
              if (callbackSuccess) callbackSuccess();
            },
            error: function (jqxhr, textStatus, error) {
              try {
                errors = JSON.parse(jqxhr.responseText);
              } catch (SyntaxError) {
                errors = { "fatal": "There was an internal error." }
              }
              if (errors.fatal) {
                if (callbackError) callbackError();
              }
              else {
                model.signup.nameError(errors.name);
                model.signup.emailError(errors.email);
              }
            }
          });

        }

        function forgot(callbackSuccess, callbackError) {
          var data = { 'email': model.forgot.email() };
          $.ajax({
            type: 'POST',
            url: 'forgotpass',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function () {
              model.forgot.emailError(null);
              if (callbackSuccess) callbackSuccess();
            },
            error: function (jqxhr, textStatus, error) {
              try {
                errors = JSON.parse(jqxhr.responseText);
              } catch (SyntaxError) {
                errors = { "fatal": "There was an internal error." }
              }
              if (errors.fatal) {
                model.forgot.fatalError(errors.fatal);
                if (callbackError) callbackError();
              }
              else {
                model.forgot.emailError(errors.email);
              }
            }
          });
        }

        function changepass(callbackSuccess, callbackError) {
          var data = { 'oldpass': model.change.oldpass(), 'newpass': model.change.newpass(), 'newpassconfirm': model.change.newpassconfirm() };
          $.ajax({
            type: 'POST',
            url: 'changepass',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function () {
              model.change.oldpassError(null);
              model.change.newpassError(null);
              model.change.newpassconfirmError(null);
              model.change.oldpass(null)
              model.change.newpass(null)
              model.change.newpassconfirm(null)
              if (callbackSuccess) callbackSuccess();
            },
            error: function (jqxhr, textStatus, error) {
              try {
                errors = JSON.parse(jqxhr.responseText);
              } catch (SyntaxError) {
                errors = { "fatal": "There was an internal error." }
              }
              if (errors.fatal) {
                model.change.fatalError(errors.fatal);
                if (callbackError) callbackError();
              }
              else {
                model.change.oldpassError(errors.old_password);
                model.change.newpassError(errors.new_password);
                model.change.newpassconfirmError(errors.new_password_confirm);
              }
            }
          });
        }


        function button_toggle() {
          if (model.user() && !model.is_public_acc()) //if user logged in
          {
            $('#btn-show-signup-dialog').hide();
            $('#login-btn').hide();
            $('#btn-forgot-pass').hide();
            $('#txt-login-user').hide();
            $('#txt-login-pass').hide();
            $('#btn-logout').show();
            $('#btn-change-pass').show();

          }
          else if (model.user() && model.is_public_acc()){
            $('#save-popup').hide();
            $('#btn-save-circuit').hide();
            $('#btn-delete').hide();
            $('#btn-change-pass').hide();
            $('#btn-show-signup-dialog').hide();
            $('#login-btn').hide();
            $('#btn-forgot-pass').hide();
            $('#txt-login-user').hide();
            $('#txt-login-pass').hide();
            $('#btn-logout').show();
          }
          else {
            $('#btn-show-signup-dialog').show();
            $('#login-btn').show();
            $('#btn-forgot-pass').show();
            $('#txt-login-user').show();
            $('#txt-login-pass').show();
            $('#btn-logout').hide();
            $('#btn-change-pass').hide();
          }
        }




      }
      else {
        model.change.oldpassError(errors.old_password);
        model.change.newpassError(errors.new_password);
        model.change.newpassconfirmError(errors.new_password_confirm);
      }
    }
  });
}

function sidemenu(idpop, user) {
  debugger;
  $('#configure-folder').modal('show');
  $('#configure-success-edit').hide();
  $('#configure-error').hide();
  $('#configure-folder-error-edit').hide();
  if (user == "demos") {
    $('#btn-configure-folder').hide();
  }
  else if (user == "myckt") {
    $('#btn-configure-folder').show();
  }

  model.configure_folder.cktid(idpop);
  var data = {
    'ckt_id': idpop
  };
  debugger;
  $.ajax({
    type: 'POST',
    url: 'getfolder',
    data: JSON.stringify(data),
    contentType: 'application/json',
    success: function (data) {
      model.configure_folder.mainfoldername(data.folderdetails.main_folder);
      model.configure_folder.subfoldername(data.folderdetails.sub_folder);
    }
  });
}

$('#configure-folder').on('click', '#btn-configure-folder', function (e) {
  /*   var deviceModel = model.device()
    if (deviceModel && !deviceModel.hasErrors()) {
      deviceModel.update();
      $('#configure-folder').modal('hide');
      editor.stack.redraw();
      editor.refreshNetlist(); // TODO or use our own callback
    } */
});

function button_toggle() {
  if (model.user() && !model.is_public_acc()) //if user logged in
  {
    $('#btn-show-signup-dialog').hide();
    $('#login-btn').hide();
    $('#btn-forgot-pass').hide();
    $('#txt-login-user').hide();
    $('#txt-login-pass').hide();
    $('#btn-logout').show();
    $('#btn-change-pass').show();
  }
  else if (model.user() && model.is_public_acc()){
    $('#save-popup').hide();
    $('#btn-save-circuit').hide();
    $('#btn-delete').hide();
    $('#btn-change-pass').hide();
    $('#btn-show-signup-dialog').hide();
    $('#login-btn').hide();
    $('#btn-forgot-pass').hide();
    $('#txt-login-user').hide();
    $('#txt-login-pass').hide();
    $('#btn-logout').show();
  }
  else {
    $('#btn-show-signup-dialog').show();
    $('#login-btn').show();
    $('#btn-forgot-pass').show();
    $('#txt-login-user').show();
    $('#txt-login-pass').show();
    $('#btn-logout').hide();
    $('#btn-change-pass').hide();
  }
}

