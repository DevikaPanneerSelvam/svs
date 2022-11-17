var strCktID;
var strUserID;
var strlink;

$(window).on("load", function () {
  // Load views into main layout.
  graph = new svs.graph.Graph(); //new constructor
  loadViews();

  getCurrentUser();
  loadDemoCircuitList();

  ko.applyBindings(model);

  $('#filter-box-clear').on('click', function () { model.filterString(''); });
  $('#demo-filter-box-clear').on('click', function () { model.demoFilterString(''); });

  $('#btn-show-signup-dialog').on('click', function (e) {
    $('#signup-success').hide();
    $('#signup-error').hide();
    $('#signup-dialog').modal('show');
  });

  $('#btn-configure-folder').on('click', function (e) {
    ConfigureFolder(function () { // Called on success
      $('#configure-success-edit').show();
    }, function () { // Called on fatal error
      $('#configure-folder-error-edit').show();
    });
  });

  /* $('#btn-edit-folder').on('click', function(e) {
    EditFolder(function() { // Called on success
      $('#configure-success-edit').show();
    }, function() { // Called on fatal error
      $('#configure-error-edit').show();
    });
  }); */

  $('#btn-signup').on('click', function (e) {
    signUp(function () { // Called on success
      $('#signup-success').show();
    }, function () { // Called on fatal error
      $('#signup-error').show();
    });
  });

  $('#btn-forgot-pass').on('click', function (e) {
    $('#forgot-success').hide();
    $('#forgot-error').hide();
    $('#forgotpass-dialog').modal('show');
  });

  $('#btn-forgot-enter').on('click', function (e) {
    forgot(function () { // Called on success
      $('#forgot-success').show();
    }, function () { // Called on fatal error
      $('#forgot-error').show();
    });
  });

  $('#btndelAccCancel').on('click', function (e) {
    $('#divConfirmDel').show();
    $('#divDeleteAccount').hide();
  });
  
  $('#btn-change-pass').on('click', function (e) {
    $('#change-success').hide();
    $('#change-error').hide();
    $('#changepass-dialog').modal('show');
    document.getElementById("btnChangetoPublic").style.backgroundColor = "gray";
    document.getElementById("btnChangePwd").style.backgroundColor = "transparent";
    document.getElementById("btnChangeEmail").style.backgroundColor = "transparent";
    document.getElementById("btnChangeUserName").style.backgroundColor = "transparent";
    
    var x = document.getElementById("divPublicAcc");
    if (x.style.display === "none") {
      x.style.display = "block";
    } 
    x = document.getElementById("divPwd");
    x.style.display = "none";
    x = document.getElementById("divEmail");
    x.style.display = "none";
    x = document.getElementById("divUsername");
    x.style.display = "none";
    x = document.getElementById("divDeleteAcc");
    x.style.display = "none";

    $('#divConfirmDel').show();
    $('#divDeleteAccount').hide();
    $('#change-success').hide();
    $.ajax({
      type: 'GET',
      url: 'ispublic',
      dataType: 'json',
      success: function (data) {
        model.change.is_public(data)
        model.change.commonSuccessMsg("Password changed successfully !")
      }
    });
  });

  $('#btnUpdateUserName').on('click', function (e) {
    if(model.change.newUserName() == "" || model.change.newUserName() == null){
      model.change.newUserNameError("Username cannot be empty");
    }
    else if(model.change.namepwd() == null || model.change.namepwd() == "")
    {
      model.change.newUserNameError(null);
      model.change.namepwdError("Password cannot be empty");
    }
    else
    {
      var data = { 'pwd': model.change.namepwd(), 'newUserName': model.change.newUserName()};
      $.ajax({
        type: 'POST',
        url: 'updateUserName',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function () {
          model.change.namepwd("");
          model.change.newUserName("");
          model.change.commonSuccessMsg("Username updated successfully!!")
          model.change.newUserNameError(null);
          model.change.namepwdError(null);
          $('#change-success').show();
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
            model.change.namepwdError(errors.name_password);
            model.change.newUserNameError(errors.name);
          }
        }
      });
    }
  });

  $('#btn-change-email').on('click', function (e) {
    if(model.change.email() == "" || model.change.email() == null){
      model.change.emailError("Please enter email id");
    }
    else if(model.change.emailpass() == "" || model.change.emailpass() == null){
      model.change.emailpassError("Please enter your password");
    }
    else {
      var data = { 'email': model.change.email(), 'pwd': model.change.emailpass()};
      $.ajax({
        type: 'POST',
        url: 'changeEmail',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function () {
          model.change.commonSuccessMsg("Email ID updated !!")
          $('#change-success').show();
          model.change.email("");
          model.change.emailpass("");
          model.change.emailError(null);
          model.change.emailpassError(null);
          if (callback)
            callback(data);
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
            model.change.emailpassError(errors.email_password);
            model.change.emailError(errors.email);
          }
        }
      });
    }
  });

  $('#btn-Save-Public-Acc').on('click', function (e) {
    var data = { 'is_public': model.change.is_public(), 'pwd': model.change.publicpass()};
    $.ajax({
      type: 'POST',
      url: 'accPublic',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: function () {
        if(model.change.is_public()){
          model.change.commonSuccessMsg("Account updated as Public Account !!")
        }
        else
          model.change.commonSuccessMsg("Account updated as Non-Public Account !!")
        $('#change-success').show();
        model.change.publicpassError("");
        model.change.publicpass("");
        if (callback)
          callback(data);
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
          model.change.publicpassError(errors.public_password);
        }
      }
    });
  });

  $('#btndelAcc').on('click', function (e) {
    if(model.change.delaccpass() != "" && model.change.delaccpass() != null){
      if(model.change.is_delete() == true){
        var data = {'pwd': model.change.delaccpass()};
        $.ajax({
          type: 'POST',
          url: 'delAccount',
          contentType: 'application/json',
          data: JSON.stringify(data),
          success: function () {
            model.change.commonSuccessMsg("Account deleted successfully !!")
            $('#change-success').show();
            logout();
            model.change.delaccpass("");
            model.change.delaccpassError(null);
            model.change.is_delete(false);
            if (callback)
              callback(data);
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
              model.change.delaccpassError(errors.delacc_password);
            }
          }
        });
      }
      else
      {
        model.change.delaccConfirmError("Please select the checkbox to confirm you want to delete the Account");
        model.change.delaccpassError(null);
      }
    }
    else{
      model.change.delaccpassError("Please enter password");
      model.change.delaccConfirmError(null);
    }
  });

  $('#btnChangetoPublic').on('click', function (e) {
    document.getElementById("btnChangetoPublic").style.backgroundColor = "gray";
    document.getElementById("btnChangePwd").style.backgroundColor = "transparent";
    document.getElementById("btnChangeEmail").style.backgroundColor = "transparent";
    document.getElementById("btnChangeUserName").style.backgroundColor = "transparent";
    
    var x = document.getElementById("divPublicAcc");
    if (x.style.display === "none") {
      x.style.display = "block";
    } 
    x = document.getElementById("divPwd");
    x.style.display = "none";
    x = document.getElementById("divEmail");
    x.style.display = "none";
    x = document.getElementById("divUsername");
    x.style.display = "none";
    x = document.getElementById("divDeleteAcc");
    x.style.display = "none";

    $('#change-success').hide();
    return false;
  });

  $('#btnChangePwd').on('click', function (e) {
    var x = document.getElementById("divPwd");
    if (x.style.display === "none") {
      x.style.display = "block";
    } 
    document.getElementById("btnChangePwd").style.backgroundColor = "gray";
    document.getElementById("btnChangeEmail").style.backgroundColor = "transparent";
    document.getElementById("btnChangeUserName").style.backgroundColor = "transparent";
    document.getElementById("btnChangetoPublic").style.backgroundColor = "transparent";

    x = document.getElementById("divPublicAcc");
    x.style.display = "none";
    x = document.getElementById("divEmail");
    x.style.display = "none";
    x = document.getElementById("divUsername");
    x.style.display = "none";
    x = document.getElementById("divDeleteAcc");
    x.style.display = "none";

    $('#change-success').hide();
    return false;
  });
  
  $('#btnChangeEmail').on('click', function (e) {
    var x = document.getElementById("divEmail");
    if (x.style.display === "none") {
      x.style.display = "block";
    } 
    document.getElementById("btnChangeEmail").style.backgroundColor = "gray";
    document.getElementById("btnChangeUserName").style.backgroundColor = "transparent";
    document.getElementById("btnChangePwd").style.backgroundColor = "transparent";
    document.getElementById("btnChangetoPublic").style.backgroundColor = "transparent";

    x = document.getElementById("divPublicAcc");
    x.style.display = "none";
    x = document.getElementById("divPwd");
    x.style.display = "none";
    x = document.getElementById("divUsername");
    x.style.display = "none";
    x = document.getElementById("divDeleteAcc");
    x.style.display = "none";

    $('#change-success').hide();
    return false;
  });

  $('#btnChangeUserName').on('click', function (e) {
    var x = document.getElementById("divUsername");
    if (x.style.display === "none") {
      x.style.display = "block";
    } 
    document.getElementById("btnChangeUserName").style.backgroundColor = "gray";
    document.getElementById("btnChangeEmail").style.backgroundColor = "transparent";
    document.getElementById("btnChangePwd").style.backgroundColor = "transparent";
    document.getElementById("btnChangetoPublic").style.backgroundColor = "transparent";

    x = document.getElementById("divPublicAcc");
    x.style.display = "none";
    x = document.getElementById("divPwd");
    x.style.display = "none";
    x = document.getElementById("divEmail");
    x.style.display = "none";
    x = document.getElementById("divDeleteAcc");
    x.style.display = "none";
    
    $('#change-success').hide();
    return false;
  });

  $('#btn-change-deleteAccount').on('click', function (e) {
    //if (confirm('Warning 1 : are you sure you want to delete your account ?')) {
        var x = document.getElementById("divDeleteAcc");
        if (x.style.display === "none") {
          x.style.display = "block";
        } 
        
        x = document.getElementById("divConfirmDel");
        x.style.display = "block";
        x = document.getElementById("divDeleteAccount");
        x.style.display = "none";
        x = document.getElementById("divPublicAcc");
        x.style.display = "none";
        x = document.getElementById("divPwd");
        x.style.display = "none";
        x = document.getElementById("divEmail");
        x.style.display = "none";
        x = document.getElementById("divUsername");
        x.style.display = "none";
        document.getElementById("btnChangeUserName").style.backgroundColor = "transparent";
        document.getElementById("btnChangeEmail").style.backgroundColor = "transparent";
        document.getElementById("btnChangePwd").style.backgroundColor = "transparent";
        document.getElementById("btnChangetoPublic").style.backgroundColor = "transparent";

        $('#change-success').hide();
        return false;
    //}
  });

  $('#btnYesDel').on('click', function (e) {
    $('#divDeleteAccount').show();
    $('#divConfirmDel').hide();
  });

  $('#btn-change-enter').on('click', function (e) {
    changepass(function () { // Called on success
      $('#change-success').show();
    }, function () { // Called on fatal error
      $('#change-error').show();
    });
  });

  $("#btn-toggle-sidebar").on("click", resizeSidebar);

  $('#circuit-list').on('click', 'a', function (e) {
    e.preventDefault();
    loadCircuit(this.href, function () { simulateNetlist(); });
  });

  $('#circuit-list-filtered').on('click', 'a', function (e) {
    e.preventDefault();
    loadCircuit(this.href, function () { simulateNetlist(); });
  });

  $('#demo-circuit-list').on('click', 'a', function (e) {
    e.preventDefault();
    loadCircuit(this.href, function () { simulateNetlist(); });
  });

  $('#demo-circuit-list-filtered').on('click', 'a', function (e) {
    e.preventDefault();
    loadCircuit(this.href, function () { simulateNetlist(); });
  });

  strCktID = document.URL.split("?")[1];
  if (strCktID != null && strCktID != undefined) {
    loadCircuit(strCktID, function () { simulateNetlist(); });
  }
});

// Initial loading of views into main layout.
function loadViews() {
  $("#bottom-left-view-container").load(pathToViews + "netlist.html", initNetlist);
  $("#top-right-view-container").load(pathToViews + "animation.html", initAnimation);
  $("#bottom-right-view-container").load(pathToViews + "graph.html", initGraph);
  $("#top-left-view-container").load(pathToViews + "editor.html", initEditor);
}

function fncSelectSignal(signalnumber){
  if(signalnumber == 1){
    if($("#math-Tab-Operand1").val() == "const"){
      $('#lblconstvalue1').show();
      $('#math-constvalue1').show();
    }
    else{
      $('#lblconstvalue1').hide();
      $('#math-constvalue1').hide();
    }
  }
  else{
    if($("#math-Tab-Operand2").val() == "const"){
      $('#lblconstvalue2').show();
      $('#math-constvalue2').show();
    }
    else{
      $('#lblconstvalue2').hide();
      $('#math-constvalue2').hide();
    }
  }
}

function initGraph() {
  graph.initView(document.getElementById('graph-container')); //init function
  $('#trace-list').on('change', 'input', function (e) {
    graph.toggleTrace(e.target.value, e.target.checked);
  }); //TODO - this goes into TS later
  ko.applyBindings(model, document.getElementById('graph-controls'));
  // Dirty fix of issue #77
  setLayout();
}

function initAnimation() {
  animation = new svs.animation.Animation(document.getElementById('animation-container'));
  animation.rotate(-0.3);
  $('#btn-animation-toggle').on('click', function (e) {
    model.animationRunning(svs.canvas.toggleTween());
  });

  $('#btn-animation-slower').on('click', function (e) {
    var speed = svs.canvas.getSpeed();
    speed = speed > 0.25 ? speed / 2 : 0.25;
    svs.canvas.setSpeed(speed);
    model.animationPlaybackSpeed(speed);
  });

  $('#btn-animation-faster').on('click', function (e) {
    var speed = svs.canvas.getSpeed();
    speed = speed < 4 ? speed * 2 : 4;
    svs.canvas.setSpeed(speed);
    model.animationPlaybackSpeed(speed);
  });

  $('#btn-animation-rotate-left').on('click', function (e) {
    animation.rotate(0.1);
  });

  $('#btn-animation-rotate-right').on('click', function (e) {
    animation.rotate(-0.1);
  });

  ko.applyBindings(model, document.getElementById('animation-controls'));
  // Dirty fix of issue #77
  setLayout();
}


function initNetlist() {
  // It's necessary to bind the ko model after the HTML file is laoded
  ko.applyBindings(model, document.getElementById('circuit-details'));
}

function EditNode(Node, netlist1) {
  if (Node.name != "gnd") {
    model.node_name(Node.name);
    model.old_node_name(Node.name);
    model.nodes(netlist1);

    $('#configure-Node-dialog').modal('show');
  } else {
    alert("The Ground Node cannot be edited");
  }
  //renameNode(netlist, Node.node_name, "10")

  //writeNetlist_new(model.circuit().parsedNetlist);


  /*     editor = new svs.editor.Editor(document.getElementById('editor-container'),
      nets = model.circuit().parsedNetlist,
      function(nets) {
        model.circuit().netlist(svs.spice.writeNetlist(nets));
        // FIXME there should always be a circuit - an empty one if none is loaded!
        if (model.circuit()) {
          model.circuit().netlist(svs.spice.writeNetlist(nets));
        }
        if (animation && animation.stack) {
          animation.stack.redraw();
        }
      }
    );  */

  //svs.spice.renameNode(svs.spice.INetlist(netlist), oldName, newName);

  //model.circuit().netlist = svs.spice.writeNetlist(netlist);
  //model.circuit().netlist(CircuitViewModel.netlist(netlist));
  //this.updateNetlistCallback(CircuitViewModel.netlist(this.netlist));
  //model.circuit().netlist.nodes[oldName].name = newName;
  //editor.load(model.circuit().parsedNetlist);
  //ditor.refreshNetlist();
  //this.circuit.parsedNetlist = netlist;
  //delete netlist.nodes[oldName];
}

function initEditor() {
  editor = new svs.editor.Editor(document.getElementById('editor-container'),
    function (device, shape) {
      model.device(new DeviceViewModel(device, shape));
      $('#configure-device-dialog').modal('show');
    },
    function (netlist) {
      // FIXME there should always be a circuit - an empty one if none is loaded!
      if (model.circuit()) {
        model.circuit().netlist(svs.spice.writeNetlist(netlist));
      }
      if (animation && animation.stack) {
        animation.stack.redraw();
      }
    }
  );

  // TODO use event delegation because the button only exists if we have a device
  $('#configure-device-dialog').on('click', '#btn-configure-device', function (e) {
    var deviceModel = model.device()
    if (deviceModel && !deviceModel.hasErrors()) {
      deviceModel.update();
      $('#configure-device-dialog').modal('hide');
      editor.stack.redraw();
      editor.refreshNetlist(); // TODO or use our own callback
    }
  });

  $('#math-tab').on('click', '#btn-Add-Output', function (e) {
    var label = $("#math-Tab-Output-Label").val().trim();
    let operand1 = $("#math-Tab-Operand1").val().trim();
    let const1 = $("#math-constvalue1").val().trim();

    let operator = $("#math-Tab-Operator").val().trim();
    let operand2 = $("#math-Tab-Operand2").val().trim();
    let const2 = $("#math-constvalue2").val().trim();

    /* manually add row to table, if label is given. TODO: table should be connected
    with with the circuit object */
    var newRow;
    if((const1 != null && const1 != "") && (const2 != null && const2 != "")){
      newRow = "<tr><td>"+label+"</td><td>"+const1+"</td><td>"+operator+
      "</td><td>"+const2+"</td><td><button class='btn btn-danger'>-</button></td></tr>";
      svs.spice.addMathExpression(model.circuit().netlist, label, const1, operator, const2);
    }
    else if(const1 != null && const1 != ""){
      newRow = "<tr><td>"+label+"</td><td>"+const1+"</td><td>"+operator+
      "</td><td>"+operand2+"</td><td><button class='btn btn-danger'>-</button></td></tr>";
      svs.spice.addMathExpression(model.circuit().netlist, label, const1, operator, operand2);
    }
    else if(const2 != null && const2 != ""){
      newRow = "<tr><td>"+label+"</td><td>"+operand1+"</td><td>"+operator+
      "</td><td>"+const2+"</td><td><button class='btn btn-danger'>-</button></td></tr>";
      svs.spice.addMathExpression(model.circuit().netlist, label, operand1, operator, const2);
    }
    else{
      newRow = "<tr><td>"+label+"</td><td>"+operand1+"</td><td>"+operator+
      "</td><td>"+operand2+"</td><td><button class='btn btn-danger'>-</button></td></tr>";
      svs.spice.addMathExpression(model.circuit().netlist, label, operand1, operator, operand2);
    }

    if (label != "") {
      $("#table-Math-Tab tbody").append(newRow);
      $("#math-Tab-Output-Label").val("");
    }
    simulateNetlist();
    $('#lblconstvalue1').hide();
    $('#math-constvalue1').hide();
    $('#lblconstvalue2').hide();
    $('#math-constvalue2').hide();
  });

  $('#configure-Node-dialog').on('click', '#btn-Edit-Node', function (e) {
    var oldName = model.old_node_name();
    var newName = model.node_name();
    netlist1 = model.nodes();

    if (newName.toLowerCase() == "gnd" || newName.trim() == "0") {
      alert("Node name '" + newName + "' is not allowed.");
    } else {
      if (newName != oldName) {
        //if (newName in netlist1.nodes) {
        //throw Error("Node name '" + newName + "' already exists in netlist.");
        //}
        //if (! (oldName in netlist1.nodes)) {
        //throw Error("No node named '" + oldName + "' in netlist.");
        //}

        for (var name in netlist1.nodes) {
          if (newName.toLowerCase() == name.toLowerCase()) {
            throw Error("Node name '" + newName + "' already exists in netlist.");
          }
        }

        var list = netlist1.nodes;

        netlist1.nodes[newName] = netlist1.nodes[oldName];
        delete netlist1.nodes[oldName];
        netlist1.nodes[newName].name = newName;


        for (i = 0; i < netlist1.devices.length; i++) {
          for (j = 0; j < netlist1.devices[i].terminals.length; j++) {
            if (netlist1.devices[i].terminals[j] == oldName) {
              netlist1.devices[i].terminals[j] = newName;
              //break;
            }
          }
        }

        nodevar = [];
        netlist1.devices.forEach(function (device) {
          for (k = 0; k < device.terminals.length; k++) {
            if ((!(device.terminals[k] in nodevar))) {
              nodevar.push(device.terminals[k]);
            }
          }
        });

        var unique = nodevar.filter((v, i, a) => a.indexOf(v) === i);

        var netvar = [];
        for (l = 0; l < unique.length; l++) {
          netvar += 'V(' + unique[l] + '), ';
        }

        netvar = netvar.substring(0, netvar.length - 2);

        netlist1.variables[0] = netvar;

        debugger;
        model.circuit().parsedNetlist = netlist1;
        //model.circuit(new CircuitViewModel(model.circuit().parsedNetlist));

        //model.circuit().netlist = svs.spice.writeNetlist(model.circuit().parsedNetlist);
        model.circuit().netlist(svs.spice.writeNetlist(model.circuit().parsedNetlist));
        //editor.load(model.circuit().parsedNetlist); 

        simulateNetlist();
      }

      $('#configure-Node-dialog').modal('hide');
    }
  });

  $('#btn-add-device').on('click', 'a', function (e) {
    e.preventDefault();
    editor.addDevice(this.href.split('#')[1]);
  });

  // TODO for all operations: on error/success: show flash message
  // TODO also, ask before discarding changes (same for loadCircuit)

  $('#btn-save-circuit').on('click', function (e) {
    var c = model.circuit(); // FIXME duplicated from saveCircuit() in main.js
    if (!c) return;
    if (c.circuit.id) {
      if (!confirm('Overwrite circuit?')) return;
    }
    saveCircuit();
  });

  $('#btn-save-circuit-as').on('click', function (e) {
    var c = model.circuit(); // FIXME duplicated from saveCircuit() in main.js
    if (!c) return;
    var newTitle = prompt("Please choose a new title:");
    c.title(newTitle);
    c.circuit.id = null;
    saveCircuit();
  });

  $('#btn-delete').on('click', function (e) {
    if (!confirm('Really delete circuit?')) return;
    deleteCircuit();
  });

  $('#btn-clear').on('click', function (e) {
    if (model.circuit() && model.circuit().hasChanges()) {
      if (!confirm('Discard unsaved changes?')) return;
    }
    clearCircuit();
  });

  $('#btn-simulate').on('click', function (e) { simulateNetlist(); });

  // Dirty fix of issue #77
  setLayout();

  clearCircuit();
}

$(document).on('click', '.form-check-input', function (e) {
  if (this.checked) {
    $(this.labels[0])[0].innerHTML = "Please save the circuit to get the share link";
    $(".form-check-label").css('color', 'red')
  }
  else {
    $(this.labels[0])[0].innerHTML = "Public";
    $(".form-check-label").css('color', 'black')
  }

  $("#btn-copy-link").hide();
});

$(document).on('click', '#btn-copy-link', function (e) {
  //var copyStr = $(".form-check-label")[0].innerHTML;
  const el = document.createElement('textarea'); // Create a <textarea> element
  el.value = strlink;  // Set its value to the string that you want copied
  el.setAttribute('readonly', ''); // Make it readonly to be tamper-proof
  el.style.position = 'absolute';
  el.style.left = '-9999px'; // Move outside the screen to make it invisible
  document.body.appendChild(el); // Append the <textarea> element to the HTML document
  el.select(); // Select the <textarea> content
  document.execCommand('copy'); // Copy - only works as a result of a user action (e.g. click events)
  document.body.removeChild(el); // Remove the <textarea> element
  alert("Copied the text: " + strlink);
  return false;
});

// Load a circuit from a URL
function loadCircuit(url, callback) {
  $.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function (data) {
      if (data.id != undefined && data.id != null) {
        model.circuit(new CircuitViewModel(data));
        editor.load(model.circuit().parsedNetlist);
        if (callback)
          callback(data);
      }
      if ((data.id == undefined || data.id == null) && strCktID != undefined && strCktID != null) {
        alert("Access to the circuit is denied, because this is not a Public circuit")
      }

      if (data.is_public == 1) {
        //strlink = 'http://localhost:8000/index?circuits/'+ data.id;
        strlink = window.location.origin + '/index?circuits/' + data.id;
        $(".form-check-label")[0].innerHTML = "Sharing link : " + strlink;
        //+ " ("+ data.id +" is the ID of the Circuit)";
        $(".form-check-label").css('color', 'green')
        $("#btn-copy-link").show();
      }
      else {
        $(".form-check-label")[0].innerHTML = "Public";
        $(".form-check-label").css('color', 'black')
        $("#btn-copy-link").hide();
      }
      if(model.is_public_acc()){
        $("#btn-copy-link").hide();
        $(".form-check-label").hide();
        $("#public-cb").hide();
      }
      else{
        $(".form-check-label").show();
        $("#public-cb").show();
      }
      getCurrentUserID(data.user_id);

    }
  });
}

function getCurrentUserID(ckt_user_id, callback) {
  $.ajax({
    type: 'GET',
    url: 'userid',
    dataType: 'json',
    success: function (data) {
      strUserID = data.user_id;
      $('#save-popup').show();
      $('#btn-save-circuit').show();
      $('#btn-delete').show();

      if (ckt_user_id != strUserID) {
        $('#btn-save-circuit').hide();
        $('#btn-delete').hide();
      }
      if (strUserID == null || strUserID == undefined) {
        $('#save-popup').hide();
      }
      if(model.is_public_acc()){
        $('#btn-save-circuit').hide();
        $('#btn-delete').hide();
        $('#save-popup').hide();
      }
      if (callback)
        callback(data);
    }
  });
}





