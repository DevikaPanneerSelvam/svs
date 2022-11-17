/* This file is part of Spicy VoltSim.
 * Copyright 2014 University of Freiburg,
 * Fritz Huettinger Chair of Microelectronics.
 * All Rights Reserved.
 * Author: Stanis Trendelenburg <stanis.trendelenburg@gmail.com>
 */

/// <reference path="svs.ts"/>
// Contains functions to read and write SPICE netlists and simulation output
// to/from the internal representation, and the list of supported SPICE devices
// and their parameters.
module svs.spice {

  function log(s: string) { console.log("spice: " + s); }

  var NC = "null"; // Value for terminals that are not connected

  // Input field separator: any number of: spaces, tabs, `,`, `(`, `)`.
  // We use `=` exclusively for keyword parameters.
  var FIELD_SEPARATOR = /[\s,()]+/;
  var KEYWORD_SEPARATOR = /\s*=\s*/;

  // ## Default device models
  var DEFAULT_MODELS = {
    d: {
      d_default: "(is=0.1pa)",
    },
    nmos: {
      nmos_default: "(level=1 kp=20u Vto=+0.7 lambda=0)",
      nmos_tech12: "(level=1 kp=360u Vto=+0.188 lambda=0.022)",
    },
    npn: {
      npn_default: "(is=14.34f vaf=74.03 bf=255.9)",
    },
    pmos: {
      pmos_default: "(level=1 kp=20u Vto=+0.7 lambda=0)",
      pmos_tech12: "(level=1 kp=63u Vto=+0.212 lambda=0.007)",
    },
    pnp: {
      pnp_default: "(is=650.6e-18 vaf=115.7 bf=231.7)",
    },
  };

  // ## Interfaces

  export interface INetlist {
    title: string;
    version: number[];
    nodes: { [name: string]: INode; };
    devices: Device[];
    options: { [name: string]: any; };
    simulation: { [name: string]: any; };
    models: { [type: string]: { [name: string]: string; }; };
    variables: string[];
    mathExpression: { [label: string]: IMathExpression; };
    //constructor(node: INetlist);
  }


  export interface IMathExpression {
    operand1: string;
    operand2: string;
    operator: string;
  }

  export interface IPosition {
    x: number;
    y: number;
    z: number;
  }

  export interface INode {
    name: string;
    offset: IPosition;
  }

  export interface IDeviceParam {
    name: string;
    label: string;
    unit: string;
    value: number;
  }

  export interface IVariable {
    name: string;
    type: string;
    min: number;
    max: number;
  }

  export interface IPlot {
    name: string;
    flags: string;
    variables: IVariable[];
    values: { [name: string]: number[] };
  }

  export interface IOutput {
    title: string;
    date: string;
    plots: IPlot[];
  }

  // ## Functions for modifying a netlist

  function getNextDeviceName(netlist: INetlist, type: string): string {
    var i = 1;
    var prefix = type.toLowerCase();
    var name = prefix + i;
    var deviceClass = svs.spice[<keyof typeof svs.spice>type];
    netlist.devices.forEach(function (device: Device) {
      if (device.name.substr(0, 1).toUpperCase() == 'B') {
          return; // equivalent to "continue" for forEach loops
      }
      if (device instanceof deviceClass) {
        do {
          name = prefix + i;
          i += 1;
        } while (name === device.name);
      }
    });
    return name;
  }

  function getNextNodeName(netlist: INetlist): string {
    //var i = 0;
    var i = 1;
    var name = i + "";
    while (name in netlist.nodes) {
      i += 1;
      name = i + "";
    }
    return name;
  }

  function getDevice(netlist: INetlist, name: string): Device {
    var idx = getDeviceIndex(netlist, name);
    return idx === -1 ? null : netlist.devices[idx];
  }

  function getDeviceIndex(netlist: INetlist, name: string): number {
    for (var i = 0; i < netlist.devices.length; i++) {
      if (netlist.devices[i].name === name) { return i; }
    }
    return -1;
  }

  export function addDevice(netlist: INetlist, type: string, name?: string, offset?: IPosition): Device {
    if (!name) { name = getNextDeviceName(netlist, type); }
    if (!offset) { offset = { x: 0, y: 0, z: 0 }; }
    if (getDevice(netlist, name)) { throw Error("Device name '" + name + "' already exists in netlist."); }
    var device = new (<any>svs.spice)[type](name);
    device.offset = offset;
    netlist.devices.push(device);
    return device;
  }

  export function addMathExpression(netlist: INetlist, label: string, operand1: string, operator: string, operand2:string) {
    if (label == "") { alert("add label"); }
    else {
      const newEntry: IMathExpression = {
        //label: label,
        operand1: operand1,
        operand2: operand2,
        operator: operator
      }
      model.circuit().parsedNetlist["mathExpression"][label] = newEntry;
    }
  }

  export function renameDevice(netlist: INetlist, oldName: string, newName: string) {
    var device = getDevice(netlist, oldName);
    if (!device) { throw Error("No device named '" + oldName + "' in netlist."); }
    if (getDevice(netlist, newName)) { throw Error("Device name '" + newName + "' already exists in netlist."); }
    device.name = newName;
  }

  export function removeDevice(netlist: INetlist, name: string) {
    var idx = getDeviceIndex(netlist, name);
    if (idx === -1) { throw Error("No device named '" + name + "' in netlist."); }
    netlist.devices.splice(idx, 1);
  }

  export function addNode(netlist: INetlist, name?: string, offset?: IPosition): INode {
    if (!name) { name = getNextNodeName(netlist); }
    if (!offset) { offset = { x: 0, y: 0, z: 0 }; }
    if (name in netlist.nodes) { throw Error("Node name '" + name + "' already exists in netlist."); }
    var node: INode = { name, offset };
    netlist.nodes[name] = node;
    return node;
  }

  export function renameNode(netlist: INetlist, oldName: string, newName: string) {
    if (!(oldName in netlist.nodes)) { throw Error("No node named '" + oldName + "' in netlist."); }
    if (newName in netlist.nodes) { throw Error("Node name '" + newName + "' already exists in netlist."); }
    netlist.nodes[newName] = netlist.nodes[oldName];
    delete netlist.nodes[oldName];
  }

  export function removeNode(netlist: INetlist, name: string) {
    if (!(name in netlist.nodes)) { throw Error("No node named '" + name + "' in netlist."); }
    netlist.devices.forEach(function (device: Device) {
      for (var i = 0; i < device.terminals.length; i++) {
        if (device.terminals[i] === name) { device.terminals[i] = NC; }
      }
    });
    delete netlist.nodes[name];
  }

  export function connectTerminal(netlist: INetlist, deviceName: string, terminalIdx: number, nodeName: string) {
    var device = getDevice(netlist, deviceName);
    if (!device) { throw Error("No device named '" + deviceName + " in netlist."); }
    if (!(nodeName in netlist.nodes)) { throw Error("No node name '" + nodeName + "' in netlist."); }
    if (terminalIdx > device.terminals.length - 1) {
      throw Error("Invalid terminal for device '" + deviceName + '": ' + terminalIdx);
    }
    disconnectTerminal(netlist, deviceName, terminalIdx); // To remove orphaned nodes.
    device.terminals[terminalIdx] = nodeName;
  }

  export function disconnectTerminal(netlist: INetlist, deviceName: string, terminalIdx: number) {
    var device = getDevice(netlist, deviceName);
    if (!device) { throw Error("No device named '" + deviceName + " in netlist."); }
    if (terminalIdx > device.terminals.length - 1) {
      throw Error("Invalid terminal for device '" + deviceName + '": ' + terminalIdx);
    }
    var nodeName = device.terminals[terminalIdx];
    device.terminals[terminalIdx] = NC;
    // remove unconnected nodes if it is not the ground node
    if (nodeName === "0") { return; }
    var isConnected = netlist.devices.some(function (device: Device): boolean {
      return (device.terminals.indexOf(nodeName) !== -1);
    });
    if (!isConnected) { delete netlist.nodes[nodeName]; }
  }

  export function getVariableType(variable: svs.spice.IVariable): string {
    // Both voltages and currents have variable.type = "voltage"
    // TODO use an enum?
    if (variable.name.match(/v\(\w+\)/)) { return "v"; }
    if (variable.name.match(/i\(@\w+\[i\w*]\)/)) { return "i"; }
    if (variable.type === "time") { return "t"; }
    return null;
  }

  export interface IDimensions {
    xMax: number;
    xMin: number;
    yMax: number;
    yMin: number;
  }

  export function getCircuitDimensions(netlist: INetlist): IDimensions {
    var coords: IPosition[] = netlist.devices.map(function (device: Device): IPosition {
      return device.offset;
    });
    for (var name in netlist.nodes) {
      coords.push(netlist.nodes[name].offset);
    }
    return {
      xMax: coords.map(function (pos) { return pos.x; }).reduce(function (a, b) { return Math.max(a, b); }),
      xMin: coords.map(function (pos) { return pos.x; }).reduce(function (a, b) { return Math.min(a, b); }),
      yMax: coords.map(function (pos) { return pos.y; }).reduce(function (a, b) { return Math.max(a, b); }),
      yMin: coords.map(function (pos) { return pos.y; }).reduce(function (a, b) { return Math.min(a, b); }),
    };
  }

  // ## SPICE devices
  //
  // For the complete list of devices and parameters supported by SPICE, see:
  // [SPICE 3 User's Manual Section 3 - Circuit Elements and Models][1]
  //
  // [1]: http://newton.ex.ac.uk/teaching/cdhw/Electronics2/userguide/sec3.html

  export class Device {
    public static params: IDeviceParam[];
    // Constructor to create the device from a line in the netlist.
    public static fromNetlist(s: string): Device {
      throw new Error("abstract method");
    }

    public terminals: string[] = [];
    public params: { [name: string]: IDeviceParam; } = {};
    public paramList: string[] = []; // ordered list of param names, for display purposes
    public offset: IPosition;
    public options: number[] = []; // TODO use an enum, call it flags
    // A subclass should pass their specific static 'params' list
    // to the constructor.
    constructor(public name: string, params: IDeviceParam[], nTerminals: number) {
      this.params = {};
      this.paramList = [];
      params.forEach(function (p) {
        this.paramList.push(p.name);
        // Initialize the 'params' property of this instance with
        // a copy of the static params, indexed by name.
        this.params[p.name] = {
          label: p.label,
          name: p.name,
          unit: p.unit,
          value: p.value,
        };
      }, this);
      for (var i = 0; i < nTerminals; i++) { this.terminals.push(NC); }
    }
    // Converts this device to a line in the netlist
    public toNetlist(): string {
      throw new Error("abstract method");
    }
    // Returns a list of '.save' commands needed for this device
    public save(): string[] {
      throw new Error("abstract method");
    }
  }

  // Resistor
  //
  //      RXXXXXXX N1 N2 VALUE
  export class R extends Device {
    public static params: IDeviceParam[] = [
      { name: "r", label: "Resistance", unit: "Ω", value: 1000 },
    ];
    public static fromNetlist(s: string): R {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new R(fields[0]);
      if (fields.length > 4) {
        device.terminals = [fields[1], fields[5]];
      } else {
        device.terminals = [fields[1], fields[2]];
      }
      device.params.r.value = parseFloat(fields[3]);
      return device;
    }

    constructor(name: string) {
      super(name, R.params, 2);
    }
    public toNetlist(): string {
      return [
        this.name + " " +  this.terminals[0] + " " + [this.name + "BsourceTerminal"] + " " + this.params.r.value.toString() +  " ; " + this.terminals[1] + "\n" +
        "Bsource" + this.name +  " " + this.name + "BsourceTerminal " + this.terminals[1] + " V=0 ; practical current measurement"].join()
      // return [
      //   this.name,
      //   this.terminals.join(" "),
      //   this.params.r.value.toString(),
      // ].join(" ");
    }
    public save(): string[] {
      return [".save @" + this.name + "[i]"];
    }
  }

  // Capacitor
  //
  //      CXXXXXXX N+ N- VALUE
  export class C extends Device {
    public static params: IDeviceParam[] = [
      { name: "c", label: "Capacitance", unit: "F", value: 0.1e-12 },
    ];
    public static fromNetlist(s: string): C {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new C(fields[0]);
      if (fields.length > 4) {
        device.terminals = [fields[1], fields[5]];
      } else {
        device.terminals = [fields[1], fields[2]];
      }
      // device.terminals = [fields[1], fields[2]];
      device.params.c.value = parseFloat(fields[3]);
      return device;
    }

    constructor(name: string) {
      super(name, C.params, 2);
    }
    public toNetlist(): string {
      return [
        this.name + " " +  this.terminals[0] + " " + [this.name + "BsourceTerminal"] + " " + this.params.c.value.toString() +  " ; " + this.terminals[1] + "\n" +
        "Bsource" + this.name +  " " + this.name + "BsourceTerminal " + this.terminals[1] + " V=0 ; practical current measurement"].join()
      //   this.name,
      //   this.terminals.join(" "),
      //   this.params.c.value.toString(),
      // ].join(" ");
    }
    public save(): string[] {
      return [".save @" + this.name + "[i]"];
    }
  }

  // Inductor
  //
  //      LYYYYYYY N+ N- VALUE
  export class L extends Device {
    public static params: IDeviceParam[] = [
      { name: "l", label: "Inductance", unit: "H", value: 1e-6 },
    ];
    public static fromNetlist(s: string): L {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new L(fields[0]);
      if (fields.length > 4) {
        device.terminals = [fields[1], fields[5]];
      } else {
        device.terminals = [fields[1], fields[2]];
      }
      // device.terminals = [fields[1], fields[2]];
      device.params.l.value = parseFloat(fields[3]);
      return device;
    }

    constructor(name: string) {
      super(name, L.params, 2);
    }
    public toNetlist(): string {
      return [
        this.name + " " +  this.terminals[0] + " " + [this.name + "BsourceTerminal"] + " " + this.params.l.value.toString() +  " ; " + this.terminals[1] + "\n" +
        "Bsource" + this.name +  " " + this.name + "BsourceTerminal " + this.terminals[1] + " V=0 ; practical current measurement"].join()
      //   this.name,
      //   this.terminals.join(" "),
      //   this.params.l.value.toString(),
      // ].join(" ");
    }
    public save(): string[] {
      return [".save @" + this.name + "[i]"];
    }
  }

  // Switch
  //
  //      SXXXXXXX N+ N- NC+ NC- MODEL
  export class S extends Device {
    public static params: IDeviceParam[] = [];
    public static fromNetlist(s: string): S {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new S(fields[0], fields[5]);
      device.terminals = [fields[1], fields[2], fields[3], fields[4]];
      return device;
    }

    constructor(name: string, public model: string = "s_default") {
      super(name, S.params, 4);
      this.model = model;
    }
    public toNetlist(): string {
      return [
        this.name,
        this.terminals.join(" "),
        this.model,
      ].join(" ");
    }
    public save(): string[] {
      return [".save @" + this.name + "[i]"];
    }
  }

  // Voltage Source
  //
  //      VXXXXXXX N+ N- DC VALUE
  //      VXXXXXXX N+ N- SIN(VO VA FREQ TD THETA)
  //      VXXXXXXX N+ N- PULSE(V1 V2 TD TR TF PW PER)
  //
  // The simple form `VXXXXXXX N+ N- VALUE` is not supported.
  export class V extends Device {
    public static types: string[] = ["dc", "sin", "pulse"];
    public static params: IDeviceParam[] = [
      // Parameters for type `dc`
      { name: "dc_v", label: "Voltage", unit: "V", value: 12 },
      // Parameters for type `sin`
      { name: "sin_vo", label: "Offset", unit: "V", value: 0 },
      { name: "sin_va", label: "Amplitude", unit: "V", value: 5 },
      { name: "sin_freq", label: "Frequency", unit: "Hz", value: 10e3 },
      { name: "sin_td", label: "Delay", unit: "s", value: 0 },
      { name: "sin_theta", label: "Damping Factor", unit: "", value: 0 },
      // Parameters for type `pulse`
      { name: "pulse_v1", label: "Initial Value", unit: "V", value: 0 },
      { name: "pulse_v2", label: "Pulsed Value", unit: "V", value: 5 },
      { name: "pulse_td", label: "Delay Time", unit: "s", value: 0 },
      { name: "pulse_tr", label: "Rise Time", unit: "s", value: 1e-6 },
      { name: "pulse_tf", label: "Fall Time", unit: "s", value: 1e-6 },
      { name: "pulse_pw", label: "Pulse Width", unit: "s", value: 50e-6 },
      { name: "pulse_per", label: "Period", unit: "s", value: 100e-6 },
    ];
    public static fromNetlist(s: string): V {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new V(fields[0], fields[3]);
      device.terminals = [fields[1], fields[2]];
      switch (device.type) {
        case "dc":
          device.params.dc_v.value = parseFloat(fields[4]);
          break;
        case "sin":
          device.params.sin_vo.value = parseFloat(fields[4]);
          device.params.sin_va.value = parseFloat(fields[5]);
          device.params.sin_freq.value = parseFloat(fields[6]);
          device.params.sin_td.value = parseFloat(fields[7]);
          device.params.sin_theta.value = parseFloat(fields[8]);
          break;
        case "pulse":
          device.params.pulse_v1.value = parseFloat(fields[4]);
          device.params.pulse_v2.value = parseFloat(fields[5]);
          device.params.pulse_td.value = parseFloat(fields[6]);
          device.params.pulse_tr.value = parseFloat(fields[7]);
          device.params.pulse_tf.value = parseFloat(fields[8]);
          device.params.pulse_pw.value = parseFloat(fields[9]);
          device.params.pulse_per.value = parseFloat(fields[10]);
          break;
        default:
          throw new Error("V: invalid type: '" + device.type + "'");
      }
      return device;
    }

    public types: string[] = []; // list of types for dropdown - instance variable
    constructor(name: string, public type: string) {
      super(name, V.params, 2);
      this.type = type || "dc"; // default for new device
      this.types = V.types;
    }
    public toNetlist(): string {
      var fields = [this.name, this.terminals.join(" "), this.type];
      switch (this.type) {
        case "dc":
          fields.push(this.params.dc_v.value.toString());
          break;
        case "sin":
          fields.push(this.params.sin_vo.value.toString());
          fields.push(this.params.sin_va.value.toString());
          fields.push(this.params.sin_freq.value.toString());
          fields.push(this.params.sin_td.value.toString());
          fields.push(this.params.sin_theta.value.toString());
          break;
        case "pulse":
          fields.push(this.params.pulse_v1.value.toString());
          fields.push(this.params.pulse_v2.value.toString());
          fields.push(this.params.pulse_td.value.toString());
          fields.push(this.params.pulse_tr.value.toString());
          fields.push(this.params.pulse_tf.value.toString());
          fields.push(this.params.pulse_pw.value.toString());
          fields.push(this.params.pulse_per.value.toString());
          break;
        default:
          throw new Error("V: invalid type: '" + this.type + "'");
      }
      return fields.join(" ");
    }
    public save(): string[] {
      return [".save @" + this.name + "[i]"];
    }
  }

  // Linear Voltage-Controlled Current Source
  //
  //      GXXXXXXX N+ N- NC+ NC- VALUE
  export class G extends Device {
    public static params: IDeviceParam[] = [
      { name: "gm", label: "Transconductance", unit: "S", value: 1 },
    ];
    public static fromNetlist(s: string): G {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new G(fields[0]);
      device.terminals = [fields[1], fields[2], fields[3], fields[4]];
      device.params.gm.value = parseFloat(fields[5]);
      return device;
    }

    constructor(name: string) {
      super(name, G.params, 4);
    }
    public toNetlist(): string {
      return [
        this.name,
        this.terminals.join(" "),
        this.params.gm.value.toString(),
      ].join(" ");
    }
    public save(): string[] {
      return [".save @" + this.name + "[i]"];
    }
  }

  // Linear Voltage-Controlled Voltage Source
  //
  //      EXXXXXXX N+ N- NC+ NC- VALUE
  export class E extends Device {
    public static params: IDeviceParam[] = [
      { name: "gain", label: "Voltage Gain", unit: "", value: 1 },
    ];
    public static fromNetlist(s: string): E {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new E(fields[0]);
      device.terminals = [fields[1], fields[2], fields[3], fields[4]];
      device.params.gain.value = parseFloat(fields[5]);
      return device;
    }

    constructor(name: string) {
      super(name, E.params, 4);
    }
    public toNetlist(): string {
      return [
        this.name,
        this.terminals.join(" "),
        this.params.gain.value.toString(),
      ].join(" ");
    }
    public save(): string[] {
      return [".save @" + this.name + "[i]"];
    }
  }

  // Current Source
  //
  //      IYYYYYYY N+ N- VALUE
  //
  // Only the simple form is supported (not `DC`/`SIN`/`PULSE`)
  export class I extends Device {
    public static params: IDeviceParam[] = [
      { name: "dc_i", label: "Current", unit: "A", value: 1e-3 },
    ];
    public static fromNetlist(s: string): I {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new I(fields[0]);
      device.terminals = [fields[1], fields[2]];
      device.params.dc_i.value = parseFloat(fields[3]);
      return device;
    }

    constructor(name: string) {
      super(name, I.params, 2);
    }
    public toNetlist(): string {
      return [
        this.name,
        this.terminals.join(" "),
        this.params.dc_i.value.toString(),
      ].join(" ");
    }
    // since we only use dc sources, we don't need to save the current
    public save(): string[] {
      return [];
    }
  }

  // Diode
  //
  //      DXXXXXXX N+ N- MNAME
  export class D extends Device {
    public static params: IDeviceParam[] = [];
    public static fromNetlist(s: string): D {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new D(fields[0], fields[3]);
      if (fields.length > 4) {
        device.terminals = [fields[1], fields[5]];
      } else {
        device.terminals = [fields[1], fields[2]];
      }
      // device.terminals = [fields[1], fields[2]];
      return device;
    }

    constructor(name: string, public model: string = "d_default") {
      super(name, D.params, 2);
      this.model = model;
      this.options = [1]; // -1: pointing up, 1: pointing down
    }
    public toNetlist(): string {
      return [
        this.name + " " +  this.terminals[0] + " " + [this.name + "BsourceTerminal"] + " " + this.model +  " ; " + this.terminals[1] + "\n" +
        "Bsource" + this.name +  " " + this.name + "BsourceTerminal " + this.terminals[1] + " V=0 ; practical current measurement"].join()
      //   this.name,
      //   this.terminals.join(" "),
      //   this.model,
      // ].join(" ");
    }
    public save(): string[] {
      return [".save @" + this.name + "[id]"]; // alternative name: 'c'
    }
  }

  // Bipolar Junction Transistor (BJT)
  //
  //      QXXXXXXX NC NB NE MNAME
  export class Q extends Device {
    public static types: string[] = ["npn", "pnp"];
    public static params: IDeviceParam[] = [];
    public static fromNetlist(s: string): Q {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new Q(fields[0], fields[4]);
      device.terminals = [fields[1], fields[2], fields[3]];
      return device;
    }

    public type: string;
    // list of types for dropdown - instance variable
    public types: string[] = [];
    constructor(name: string, public model: string = "npn_default") {
      super(name, Q.params, 3);
      this.model = model;
      this.type = model.substr(0, 1) == "p" ? "pnp" : "npn";
      this.types = Q.types;
      this.options = [1]; // 1: base to the left, -1: base to the right
    }
    public toNetlist(): string {
      return [
        this.name,
        this.terminals.join(" "),
        // this.model FIXME allow to set model
        this.type + "_default",
      ].join(" ");
    }
    public save(): string[] {
      return [
        ".save @" + this.name + "[ic]",
        ".save @" + this.name + "[ib]",
        ".save @" + this.name + "[ie]"];
    }
  }

  // MOSFET
  //
  //      MXXXXXXX ND NG NS NB MNAME <L=VAL> <W=VAL>
  export class M extends Device {
    public static models: string[] = ["_default", "_tech12"];
    public static types: string[] = ["nmos", "pmos"];
    public static params: IDeviceParam[] = [
      // The mosfet's parameters are the same for all values of `type`.
      // This is indicated by the `_` prefix. Note that both are optional
      // for SPICE even though it doesn't make sense in practice.
      { name: "_w", label: "Width", unit: "m", value: 1e-6 },
      { name: "_l", label: "Length", unit: "m", value: 1e-6 },
    ];
    public static fromNetlist(s: string): M {
      var fields = s.split(FIELD_SEPARATOR);
      var device = new M(fields[0], fields[5]);
      // device.terminals = [fields[1], fields[2], fields[3], fields[4]];
      if (fields.length > 8) {
        device.terminals = [fields[9], fields[2], fields[3], fields[4]];
      } else {
        device.terminals = [fields[1], fields[2], fields[3], fields[4]];
      }
      fields.forEach(function (field) {
        var kw = field.toLowerCase().split(KEYWORD_SEPARATOR);
        if (kw[0] == "w") { device.params._w.value = parseFloat(kw[1]); }
        if (kw[0] == "l") { device.params._l.value = parseFloat(kw[1]); }
      });
      return device;
    }


    public type: string;
    public types: string[] = []; // list of types for dropdown - instance variable
    public models: string[] = []; // list of models for dropdown - instance variable
    constructor(name: string, public model: string = "nmos_default") {
      super(name, M.params, 4);
      // this.type = model.substr(0, 1) == "p" ? "pmos" : "nmos";
      this.type = model.substr(0, 4);
      this.types = M.types;
      this.model = model.substr(4);
      this.models = M.models;
      this.options = [1]; // 1: gate to the left, -1: gate to the right
    }
    public toNetlist(): string {
      // var fields = [
      //   this.name,
      //   this.terminals.join(" "),
      //   // this.model FIXME allow to set model
      //   // this.type + "_default",
      //   this.type + this.model
      // ];
      // if (this.params._l.value) { fields.push("l=" + this.params._l.value.toString()); }
      // if (this.params._w.value) { fields.push("w=" + this.params._w.value.toString()); }
      // fields.push(";");
      // fields.push(this.terminals[0]);
      // fields.push("\n");
      // fields.push("\n");
      // return fields.join();

      return [
        this.name + " " +
        this.name + "BsourceTerminal " +
        [this.terminals[1],this.terminals[2],this.terminals[3]].join(" ") + " " +
        this.type + this.model +
        " l=" + this.params._l.value.toString() +
        " w=" + this.params._w.value.toString() +
        " ; " +
        this.terminals[0] + 
        "\n" +
        "Bsource" + this.name +  " " + this.name + "BsourceTerminal " + this.terminals[0] + " V=0 ; practical current measurement"].join()
    }
    public save(): string[] {
      return [
        ".save @" + this.name + "[id]",
        // ".save @" + this.name + "[ig]",
        // '.save @' + this.name + '[is]', // we assume i_G, i_B are 0 and id = -is
        ".save @" + this.name + "[vdsat]",
        ".save @" + this.name + "[von]"];
    }
  }

  // ## Functions

  // Helper function to parse a string of comma-separated numbers
  function parseFloatList(s: string, sep: string = ","): number[] {
    var fields: string[] = s.split(sep);
    var values: number[] = [];
    fields.forEach(function (f) { if (f.trim()) { values.push(parseFloat(f)); } });
    return values;
  }

  // Helper function to parse a string of comma-separated integers
  function parseIntList(s: string, sep: string = ","): number[] {
    var fields: string[] = s.split(sep);
    var values: number[] = [];
    fields.forEach(function (f) { values.push(parseInt(f, 10)); });
    return values;
  }

  export function changeNetlist(input: string): string {
    var changedNetlist = "";

    // The input to this function is a multi-line string. We iterate over
    // the string one line at a time. `lineNo` holds the current line
    // number, `line` holds the current line.
    var lines: string[] = input.split("\n");
    var lineNo = 0;
    var line = "";

    // The `_log` function prefixes the log message with the current line
    // number.
    function _log(s: string) { log("netlist[" + lineNo + "]: " + s); }

    // We create an empty netlist object that we're going to populate with
    // information.
    var netlist: INetlist = {
      devices: [],
      models: {},
      nodes: {},
      options: {},
      simulation: {},
      title: "",
      variables: [],
      version: [],
      mathExpression: {},
    };

    // Initialize the default device models
    for (var type in DEFAULT_MODELS) {
      for (var name in (<any>DEFAULT_MODELS)[type]) {
        netlist.models[type] = netlist.models[type] || {};
        netlist.models[type][name] = (<any>DEFAULT_MODELS)[type][name];
      }
    }

    // TODO use an enum
    var S_TITLE = 0;
    var S_VERSION = 1;
    var S_PREAMBLE = 2;
    var S_DEVICE = 3;
    var S_OPTIONS = 4;
    var S_STATEMENT = 5;
    var S_COMMENT = 6;
    var S_END = 7;

    var state = S_TITLE;

    for (lineNo = 1; lineNo < lines.length; lineNo++) {
      line = lines[lineNo];
      if (line.substr(0, 5) == ".end") {
        state = S_END;
        break;
      } else if (line.substr(0, 1) == "*") {
        switch (state) {
          // A comment immediately following the title contains the SVS
          // version number, except if we're importing an SVS2 netlist.
          // SVS2 has no version number, so we can skip to the preable
          // in this case (see below).
          case S_TITLE:
            if (line.substr(0, 10) == "* version:") {
              state = S_VERSION;
            } else {
              state = S_PREAMBLE;
            }
            break;
          // A block of comments immediately following the version (or title
          // in SVS2) contain SVS interal state information and information
          // about the nodes in the circuit.
          //
          // We call this block the preamble.
          case S_VERSION:
            state = S_PREAMBLE;
            break;
          case S_PREAMBLE:
            break;
          // A comment immediately following a device line contains the SVS
          // options for this device (x, y, z position, etc.).
          case S_DEVICE:
            state = S_OPTIONS;
            break;
          // Any other comment is just a regular comment and has no special
          // meaning.
          default:
            state = S_COMMENT;
        }
      } else if (line.substr(0, 1) == ".") {
        state = S_STATEMENT;
      } else {
        state = S_DEVICE;
      }

      //      switch (state) {
      //        case S_DEVICE:
      //          var prefix = line.substr(0, 1).toUpperCase();
      //          var gnd_line = line;
      //          for(var i = 0; i < 4; i++){
      //            gnd_line = gnd_line.replace(" 0 "," gnd ");
      //          }
      //          input = input.replace(line,gnd_line)
      //          }
      //      }

      // DO NOT REPLACE DEVICE PARAMETERS, ONLY NODES!
      switch (state) {
        case S_DEVICE:
          //var prefix = line.substr(0, 1).toUpperCase();
          var gnd_line = line.split(" ");
          var depth = 0

          switch (gnd_line[0].charAt(0)) {
            case "m":
              depth = 5;
            case "q":
              depth = 4;
            default:
              depth = 3;
          }
          gnd_line.forEach(function (item, index) {
            if (index < depth && item == "0") {
              gnd_line[index] = "gnd";
            }
          });
          input = input.replace(line, gnd_line.join(" "))
      }
    }

    changedNetlist = input;
    return changedNetlist;
  }
  // ### Parse a SPICE netlist string to a netlist object
  //
  // TODO: merge version and preamble
  export function readNetlist(input: string): INetlist {
    // The input to this function is a multi-line string. We iterate over
    // the string one line at a time. `lineNo` holds the current line
    // number, `line` holds the current line.
    var lines: string[] = input.split("\n");
    var lineNo = 0;
    var line = "";

    // The `_log` function prefixes the log message with the current line
    // number.
    function _log(s: string) { log("netlist[" + lineNo + "]: " + s); }

    // We create an empty netlist object that we're going to populate with
    // information.
    var netlist: INetlist = {
      devices: [],
      models: {},
      nodes: {},
      options: {},
      simulation: {},
      title: "",
      variables: [],
      version: [],
      mathExpression: {},
    };

    // Initialize the default device models
    for (var type in DEFAULT_MODELS) {
      for (var name in (<any>DEFAULT_MODELS)[type]) {
        netlist.models[type] = netlist.models[type] || {};
        netlist.models[type][name] = (<any>DEFAULT_MODELS)[type][name];
      }
    }

    // TODO use an enum
    var S_TITLE = 0;
    var S_VERSION = 1;
    var S_PREAMBLE = 2;
    var S_DEVICE = 3;
    var S_OPTIONS = 4;
    var S_STATEMENT = 5;
    var S_COMMENT = 6;
    var S_END = 7;

    var state = S_TITLE;
    var v2nodeIdx: number = 0; // For keeping track of SVS 2.x node names.

    // The first line always contains the netlist title.
    netlist.title = lines[0];

    for (lineNo = 1; lineNo < lines.length; lineNo++) {
      line = lines[lineNo];

      // #### Determine the current state.

      // The `.end` marker marks the end of the netlist.
      if (line.substr(0, 5) == ".end") {
        state = S_END;
        break;
      } else if (line.substr(0, 1) == "*") {
        switch (state) {
          // A comment immediately following the title contains the SVS
          // version number, except if we're importing an SVS2 netlist.
          // SVS2 has no version number, so we can skip to the preable
          // in this case (see below).
          case S_TITLE:
            if (line.substr(0, 10) == "* version:") {
              state = S_VERSION;
            } else {
              state = S_PREAMBLE;
            }
            break;
          // A block of comments immediately following the version (or title
          // in SVS2) contain SVS interal state information and information
          // about the nodes in the circuit.
          //
          // We call this block the preamble.
          case S_VERSION:
            state = S_PREAMBLE;
            break;
          case S_PREAMBLE:
            break;
          // A comment immediately following a device line contains the SVS
          // options for this device (x, y, z position, etc.).
          case S_DEVICE:
            state = S_OPTIONS;
            break;
          // Any other comment is just a regular comment and has no special
          // meaning.
          default:
            state = S_COMMENT;
        }
      } else if (line.substr(0, 1) == ".") {
        state = S_STATEMENT;
      } else {
        state = S_DEVICE;
      }

      // #### Parse the current line.
      switch (state) {
        // The version line. Example:
        //
        //      * version: 3.0.0
        //
        case S_VERSION:
          var fields = line.split(/\s+/);
          netlist.version = parseIntList(fields[2], ".");
          break;

        case S_PREAMBLE:
          // If we're in the preamble and haven't seen a version number yet,
          // we must be importing a SVS2 netlist (which does not have a version
          // number), so we set the version to "2.0.0".
          if (netlist.version.length == 0) {
            netlist.version = [2, 0, 0];
          }
          var fields = line.split(/\s+/);
          // The preamble contains SVS2 internal state information.
          // We don't use this for anything else (yet), so we can ignore it.
          if (fields[1] == "state") {
            _log("state information ignored: " + line);
          } else if (fields.length == 3) {
            var nodeName = fields[1];
            var p = parseFloatList(fields[2]);
            // In SVS2 nodes have extra display names like "gnd", "p02", etc.
            // These are independent of the actual node name, e.g. "p04" can
            // be node 1, but "gnd" is always node 0.
            // The nodes are listed in order, from 0 to n, so we just assign
            // them consecutive numbers and discard the original names.
            if (netlist.version[0] == 2) {
              nodeName = v2nodeIdx + "";
              v2nodeIdx += 1;
            }
            netlist.nodes[nodeName] = { name: nodeName, offset: { x: p[0], y: p[1], z: p[2] } };
          } else {
            _log("other information ignored: " + line);
          }
          break;

        case S_DEVICE:
          var prefix = line.substr(0, 1).toUpperCase();
          // The first character of the device name specifies the device
          // type (the prefix).
          // To create the device object we look up the prefix as a class name
          // and call the static `fromNetlist()` method.
          // The class knows how to parse it's own device line.
          if (prefix in svs.spice) {
            var device = (<any>svs.spice)[prefix].fromNetlist(line);
            netlist.devices.push(device);
          } else {
            _log("unknown device: " + line);
          }
          break;

        // The device options line contains a list of options for the last
        // device we've seen. These are the x, y, and z position of the
        // device, plus any number of device-specific flags (numbers), which
        // we assign to the `.options` property of the device.
        case S_OPTIONS:
          var fields = line.split(/\s+/);
          var options = parseFloatList(fields[1]);
          var lastDevice = netlist.devices[netlist.devices.length - 1];
          lastDevice.offset = {
            x: options.shift(),
            y: options.shift(),
            z: options.shift(),
          };
          lastDevice.options = options;
          break;

        // The SPICE statements we care about (other than `.end` wich is
        // handled separately) are:
        case S_STATEMENT:
          var fields = line.split(/\s+/);
          switch (fields[0]) {
            //  - `.tran` - Transient simulation.
            case ".tran": // TODO
              netlist.simulation.type = "transient";
              netlist.simulation.tstep = parseFloat(fields[1]);
              netlist.simulation.tstop = parseFloat(fields[2]);
              netlist.simulation.tstart = parseFloat(fields[3]);
              //netlist.simulation.tmax = parseFloat(fields[4]);
              // Some SVS2 netlist have tstart and tstop switched around, which seems to have worked
              // in some old version of spice, but locks up ngspice
              if (netlist.simulation.tstop < netlist.simulation.tstart) {
                _log("Warning: tstop < tstart. Swapping tstop and tstart.");
                var tmp = netlist.simulation.tstop;
                netlist.simulation.tstop = netlist.simulation.tstart;
                netlist.simulation.tstart = tmp;
              }
              break;
            //  - `.model` - A device model specification.
            case ".model": // TODO
              var mName = fields[1];
              var mType = fields[2];
              netlist.models[mType] = netlist.models[mType] || {};
              netlist.models[mType][mName] = fields.slice(3).join(" ");
              break;
            //  - `.save` - Declares a variable to be saved during simulation.
            case ".save": // TODO
              var saveExpr = fields.slice(1).join(" ");
              netlist.variables.push(saveExpr);
              break;
            //  - `.options` - Options for the simulator.
            case ".options": // TODO
              var opts = fields.slice(1);
              opts.forEach(function (o: string) {
                var kv = o.split(KEYWORD_SEPARATOR);
                netlist.options[kv[0]] = kv[1];
              });
              break;
            // We ignore any other statements.
            default:
              _log("statement ignored: " + line);
          }
          break;

        // We ignore regular comments.
        case S_COMMENT:
          _log("comment ignored: " + line);
          break;
      }
    }

    // When we've reached the end of the string, we should be in the
    // "end" state.
    if (state != S_END) {
      _log("did not reach end of netlist");
      throw new Error("did not reach end of netlist");
    }

    return netlist;
  }

  // ### Export a netlist object to a SPICE netlist (string)
  export function writeNetlist(netlist: INetlist): string {
    var lines: string[] = [];
    var saveLines: string[] = []; // .save statements for nodes

    // The first line contains the netlist title.
    lines.push(netlist.title);

    // The preamble contains the version information, followed by a line
    // with the name and position of each node in the circuit.
    // All lines in the preamble are comments (prefixed with `*`).
    lines.push("* version: " + svs.version.join("."));
    for (var name in netlist.nodes) {
      var node = netlist.nodes[name];
      lines.push("* " + netlist.nodes[name].name + " " + [node.offset.x, node.offset.y, node.offset.z].join(","));
      // don't put .save lines into preamble
      if (netlist.nodes[name].name !== "gnd") { saveLines.push(".save v(" + netlist.nodes[name].name + ")"); }
    }

    netlist.variables.forEach(function (v) { 
      //lines.push('.save ' + v); 
      var splitcheck = v.split("=par")
      if(splitcheck.length > 1){
        saveLines.push(".save " + v + ")");
      }
    });


    // Call the `toNetlist()` method of each device to convert it to a string.
    // The position and device-specific options are encoded in a comment
    // immediately following the device line.
    netlist.devices.forEach(function (device) {
      lines.push(device.toNetlist());
      lines.push("* " + [device.offset.x, device.offset.y, device.offset.z].join(",")
        + "," + device.options.join(","));
      saveLines.push.apply(saveLines, device.save());
    });
    
    // Add math expressions to netlist
    for (const key in netlist.mathExpression) {
      let value = netlist.mathExpression[key];
      saveLines.push(".save "+key+"=par('"+value.operand1+" "
                      +value.operator+" "+value.operand2+"')");
    }

    // Add the .save commands
    lines.push.apply(lines, saveLines);
  

    // WORKING!!!!
    //saveLines.push(".save Ibias=par('i(vip) + i(vdd)')");
    //saveLines.push(".save Ibias=par('i(vip) - i(vin)')");

    //saveLines.push(".save VoutDiff=par('v(VoutP) - v(VoutN)')");
    //saveLines.push(".save VinDiff=par('v(VinP) - v(VinN)')");
    //saveLines.push(".save diffGain = par('abs(v(VoutDiff) / v(VinDiff))')");

    // saveLines.push(".save Pbias=par('(i(Bsourcer04)+i(Bsourcer05))*v(vdd)')");

    // NOOOOOOTTTTT working...
    //saveLines.push(".save Ibias=par('i(r04) - i(r05)')");
    //saveLines.push(".save Ibias=par('@r04[i] - @r05[i]')");
    //saveLines.push(".save Ibias=par('@r04[i]')");


    // Next, we add `.model` statements for all device models we know about.
    for (var type in netlist.models) { // TODO
      for (var name in netlist.models[type]) {
        lines.push(".model " + name + " " + type + " " +
          netlist.models[type][name]);
      }
    }

    // The following fields are optional

    // We currently only handle transient simulations.
    if (("simulation" in netlist)
      && (netlist.simulation.type == "transient")) {
        lines.push(".tran " + 
        [(netlist.simulation.tstop-netlist.simulation.tstart)/2000,
        netlist.simulation.tstop,
        netlist.simulation.tstart].join(" "));
        // netlist.simulation.tmax].join(" "));

        // lines.push(".tran " + [netlist.simulation.tstep,
        // netlist.simulation.tstop,
        // netlist.simulation.tstart,
        // netlist.simulation.tmax].join(" "));
    } else {
      // Use default values
      lines.push(".tran " + [
        // FIXME these values are from SVS2. Why these numbers?
        1e-9, // tstep
        1e-6, // tstop
        0, // tstart
        //1e-6, // tmax

        // // FIXME these values are from SVS2. Why these numbers?
        // 2.77777777777778e-7, // tstep
        // 0.0001, // tstop
        // 0, // tstart
        // 2.77777777777778e-7, // tstop
      ].join(" "));
    }

    // Simulator options
    if ("options" in netlist) {
      // TODO
      var opts: string[] = [];
      for (var k in netlist.options) {
        var v = netlist.options[k];
        if (typeof (v) === "undefined") {
          opts.push(k);
        } else {
          opts.push(k + "=" + v);
        }
      }
      if (opts.length) { lines.push(".options " + opts.join(" ")); }
    }

    // Saved variables
    // TODO we alway overwrite these.
    if ("variables" in netlist) {
      // TODO
      // netlist.variables.forEach(function (v) { lines.push('.save ' + v); });
    }

    // The last line contains the eof marker.
    lines.push(".end");
    return lines.join("\n");
  }

  // ### Parse SPICE simulator output in ASCII format
  //
  // See `man 1 sconvert` or `man 1 ngsconvert` for details.
  export function readOutput(input: string): IOutput {
    var lines: string[] = input.split("\n");
    var lineNo = 0;
    var line = "";

    var output: IOutput = {
      date: "",
      plots: [],
      title: "",
    };

    // States
    // TODO use an enum
    var S_HEADER = 0;
    var S_PLOT = 1;
    var S_VARS = 2;
    var S_VALUES = 3;

    var state = S_HEADER;
    var plot: IPlot; // the current plot
    var timestep: number; // the current timestep
    var variable: number; // the current variable
    for (lineNo = 0; lineNo < lines.length; lineNo++) {
      line = lines[lineNo];

      // Determine next state
      if (line.substr(0, 9) == "Plotname:") {
        state = S_PLOT;
      } else if (line.substr(0, 10) == "Variables:") {
        state = S_VARS;
        continue; // skip this line
      } else if (line.substr(0, 7) == "Values:") {
        state = S_VALUES;
        continue; // skip this line
      }

      // Parse current line
      switch (state) {
        case S_HEADER:
          // 'Title' and 'Date' fields
          // Example:
          //
          //     Title: basisstufe
          //     Date: Fri Jan 13 16:19:51  2012
          var kv = line.split(": ");
          switch (kv[0]) {
            case "Title":
              output.title = kv[1];
              break;
            case "Date":
              output.date = kv[1];
              break;
            default:
              log("Unknown header ignored: " + line);
          }
          break;
        case S_PLOT:
          // An output file can contain one or more "plot" sections.
          // The section header contains additional key: value pairs
          var kv = line.split(": ");
          switch (kv[0]) {
            case "Plotname":
              // Create a new plot
              plot = { name: kv[1], flags: "", variables: [], values: {} };
              output.plots.push(plot);
              break;
            case "Flags":
              plot.flags = kv[1];
              break;
            default:
              log("Unknown plot header ignored: " + line);
          }
          break;
        case S_VARS:
          // The variables of the current plot (tab-separated, with
          // leading tab).
          // Example:
          //
          //         0   time    time
          //         1   v(1)    voltage
          //         2   v(2)    voltage
          //         3   v(3)    voltage
          //         4   v(@v_ck1[i])    voltage
          //         5   v(@v_ck2[i])    voltage
          var fields = line.split(/\t+/);
          var idx = parseInt(fields[1], 10);
          plot.variables[idx] = { name: fields[2], type: fields[3], min: null, max: null };
          break;
        case S_VALUES:
          // List of values for each variable, grouped by timestep. Each group
          // (paragraph) contains the timestep and value of the first variable
          // (tab-separated) in the first line, followed by the values for the
          // rest of the variables (with leading tab). Paragraphs are separated
          // by a blank line.
          //
          // Example for 3 variables and 2 timesteps:
          //
          //         0 $value_1_0
          //           $value_2_0
          //           $value_3_0
          //
          //         1 $value_1_1
          //           $value_2_1
          //           $value_3_1
          //
          // where `$value_i_j` is the value of variable `i` for timestep
          // number `j` (for transient simulations, variable 1 is the time)
          //
          if (!line.length) { continue; }// skip blank lines

          var fields = line.split(/\t+/);

          // New timestep
          if (fields[0].length) {
            variable = 0;
            timestep = parseInt(fields[0], 10);
          }
          var value = parseFloat(fields[1]);
          var v = plot.variables[variable];
          if (timestep == 0) {
            // Initialize min/max values with first timestep
            v.min = value;
            v.max = value;
            // Create list of values
            plot.values[v.name] = [];
          } else {
            // Update min/max as required
            if (value < v.min) { v.min = value; }
            if (value > v.max) { v.max = value; }
          }
          plot.values[v.name].push(value);
          variable += 1;
          break;
      }
    }

    return output;
  }
}