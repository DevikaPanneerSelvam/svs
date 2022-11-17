var model = {
  user: ko.observable(null),
  is_public_acc: ko.observable(null),
  filterString: ko.observable(''),
  demoFilterString: ko.observable(''),
  circuitList: ko.observable([]),
  demoCircuitList: ko.observable([]),
  demoCircuitListFiltered: ko.observable([]),
  circuitListFiltered: ko.observable([]),
  demoMainFoldersList: ko.observable([]),
  demoSubFoldersList: ko.observable([]),
  mycircuits: ko.observable({
    folder: ko.observableArray([{
      main_folder_name: ko.observable([]),
      contents: ko.observableArray([{
        sub_folder_id: ko.observable([]),
        sub_folder_name: ko.observable([]),
        sub_main_folder: ko.observable([]),
        contents: ko.observableArray([])
      }]),
      circuits: ko.observable([])
    }]),
    directcircuits: ko.observable([])
  }),
  demo: ko.observable({
    folder: ko.observableArray([{
      main_folder_name: ko.observable([]),
      contents: ko.observableArray([{
        sub_folder_id_demo: ko.observable([]),
        sub_folder_name: ko.observable([]),
        contents: ko.observableArray([])
      }]),
      circuits: ko.observable([])
    }]),
    directcircuits: ko.observable([])
  }),
  traces: ko.observable([]),
  traces_graph: ko.observable([]),
  device: ko.observable(),
  node_name: ko.observable(''),
  old_node_name: ko.observable(''),
  nodes: ko.observable(),
  circuit: ko.observable(),
  animationReady: ko.observable(false),
  animationRunning: ko.observable(false),
  animationPlaybackSpeed: ko.observable(1.0),
  configure_folder: {
    mainfoldername: ko.observable(''),
    subfoldername: ko.observable(''),
    cktid: ko.observable(''),
    mainError: ko.observable(null),
    subError: ko.observable(null),
    fatalError: ko.observable(null)
  },
  signup: {
    name: ko.observable(''),
    email: ko.observable(''),
    is_public: ko.observable(),
    nameError: ko.observable(null),
    emailError: ko.observable(null),
    fatalError: ko.observable(null)
  },
  forgot: {
    email: ko.observable(''),
    emailError: ko.observable(null),
    fatalError: ko.observable(null)
  },
  change: {
    oldpass: ko.observable(''),
    email: ko.observable(''),
    namepwd: ko.observable(''),
    newUserName: ko.observable(''),
    currpass: ko.observable(''),
    emailpass: ko.observable(''),
    publicpass: ko.observable(''),
    delaccpass: ko.observable(''),
    newpass: ko.observable(''),
    newpassconfirm: ko.observable(''),
    oldpassError: ko.observable(null),
    namepwdError: ko.observable(null),
    commonSuccessMsg: ko.observable(null),
    emailError: ko.observable(null),
    emailpassError: ko.observable(null),
    newUserNameError: ko.observable(null),
    currpassError: ko.observable(null),
    publicpassError: ko.observable(null),
    newpassError: ko.observable(null),
    newpassconfirmError: ko.observable(null),
    fatalError: ko.observable(null),
    delaccpassError: ko.observable(null),
    is_public: ko.observable(),
    is_delete: ko.observable(false),
    delaccConfirmError: ko.observable(null)
  }
};


// Custom knockout.js validators

// Validate a SPICE device name
// FIXME Validate uniqueness within netlist, coerce to lowercase.
ko.extenders.name = function (target) {
  target.hasError = ko.observable();

  function validate(value) {
    target.hasError(!(value.trim().match(/^[a-zA-Z0-9]+$/)));
  }

  validate(target()); // Validate initial value
  target.subscribe(validate); // Subscribe to changes
  return target; // Return original observable
};

// Validate a floating point number
ko.extenders.number = function (target) {
  target.hasError = ko.observable();

  function validate(value) {
    target.hasError(!(value.trim().match(svs.util.numberRE)));
  }

  validate(target()); // Validate initial value
  target.subscribe(validate); // Subscribe to changes
  return target; // Return original observable
};

// Class for model.device observable
var DeviceViewModel = function (device, shape) {
  this.device = device;
  this.shape = shape;
  this.prefix = device.name.substr(0, 1);
  this.name = ko.observable(device.name.substr(1)).extend({ name: 1 }); // Dummy value
  this.type = ko.observable(device.type);
  this.model = ko.observable(device.model);
  this.oldType = device.type;
  this.types = device.types;
  this.paramList = device.paramList;
  this.models = device.models;

  var params = device.paramList.map(function (name) {
    var param = device.params[name];
    return {
      name: param.name,
      unit: param.unit,
      label: param.label,
      value: ko.observable(svs.util.numberToString(param.value)).extend({ number: 1 }) // Dummy value
    };
  });
  this.params = ko.observable(params);

  this.paramsForType = ko.computed(function () {
    var t = this.type();
    if (!t) return this.params();
    var prefix = t.split('_')[0];
    return this.params().filter(function (param) {
      return (param.name.substr(0, prefix.length + 1) === prefix + '_') || (param.name[0] === '_');
    });
  }, this);

  this.hasErrors = ko.computed(function () {
    var params = this.params();
    return this.name.hasError() || params.some(function (param) { return param.value.hasError(); });
  }, this);

  if (this.prefix === 'm' || this.prefix === 'q') {
    this.type.subscribe(function (newType) {
      if (newType !== this.oldType) { this.shape.flipVertical(); }
      this.oldType = this.type();
    }, this);
  }
};

DeviceViewModel.prototype.update = function () {
  this.device.name = this.prefix + this.name().trim();
  this.device.type = this.type();
  this.device.model = this.model();
  this.params().forEach(function (param) {
    this.device.params[param.name].value = svs.util.numberFromString(param.value());
  }, this);
};

function setPageTitle(title, hasChanges) {
  document.title = (hasChanges ? '* ' : '') + title + ' - Spicy VoltSim';
}

//Class for model.demoCircuitListFiltered observable

// Class for model.circuit observable
var CircuitViewModel = function (circuit) {
  this.circuit = circuit;
  this.description = ko.observable(circuit.description);
  this.is_public = ko.observable(circuit.is_public);
  var changed_Netlist = svs.spice.changeNetlist(circuit.netlist);
  this.netlist = ko.observable(changed_Netlist);
  this.title = ko.observable(circuit.netlist.split('\n')[0]);

  var netlist = svs.spice.readNetlist(circuit.netlist);
  this.parsedNetlist = netlist;

  this.tstart = ko.observable(svs.util.numberToString(netlist.simulation.tstart || 0)).extend({ number: 1 }); // Dummy value
  this.tstop = ko.observable(svs.util.numberToString(netlist.simulation.tstop || 0.000001)).extend({ number: 1 }); // Dummy value
  this.temp = ko.observable(svs.util.numberToString(netlist.options.temp || 27)).extend({ number: 1 }); // Dummy value
  this._state = this._getState();


  function syncNetlist() {
    var netlist = this.parsedNetlist;
    netlist.title = this.title();
    netlist.simulation.tstart = svs.util.numberFromString(this.tstart());
    netlist.simulation.tstop = svs.util.numberFromString(this.tstop());
    netlist.options.temp = svs.util.numberFromString(this.temp());
    this.netlist(svs.spice.writeNetlist(netlist));
  }

  this.title.subscribe(syncNetlist, this);
  this.tstart.subscribe(syncNetlist, this);
  this.tstop.subscribe(syncNetlist, this);
  this.temp.subscribe(syncNetlist, this);

  this.hasChanges = ko.computed(function () {
    var state = this._getState();
    var rv = false;
    if (state !== this._state) {
      rv = true;
    }
    this._state = state;
    setPageTitle(this.title(), rv);
    return rv;
  }, this);

  setPageTitle(this.title(), false);
};

CircuitViewModel.prototype._getState = function () {
  return ko.toJSON({
    'title': this.title(),
    'description': this.description(),
    'netlist': this.netlist(),
    'tstart': this.tstart(),
    'tstop': this.tstop(),
    'temp': this.temp()
  });
};

model.circuitListFiltered = ko.computed(function () {
  var list = model.circuitList(); // TODO make 'model' a class and use this.circuitList
  var filter = model.filterString().toLowerCase();
  return list.filter(function (item) { return item.title.toLowerCase().indexOf(filter) !== -1 });
});

model.demoCircuitListFiltered = ko.computed(function () {
  var list = model.demoCircuitList();
  var filter = model.demoFilterString().toLowerCase();
  return list.filter(function (item) { return item.title.toLowerCase().indexOf(filter) !== -1 });
});   