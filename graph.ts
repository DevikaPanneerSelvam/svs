/**
 * This file is part of Spicy VoltSim.
 * @copyright 2014 University of Freiburg, Fritz Huettinger Chair of Microelectronics. All Rights Reserved.
 * @author Stanis Trendelenburg <stanis.trendelenburg@gmail.com>
 * @author Jan Kuehn <jan.kuehn@imtek.uni-freiburg.de>
 */

/// <reference path="canvas.ts"/>
/// <reference path="spice.ts"/>
/// <reference path="util.ts"/>

/**
 * Graph module handles the voltage and current plot.
 */
namespace svs.graph {

  /** Contains information about a trace that is displayed in the graph. */
  export interface ITrace {
    name: string;
    type: string;
    variable: svs.spice.IVariable;
    trace: Trace;
    enabled: boolean;
  }

  /** Holds scale (min and max) for time, voltage and current. */
  export interface IScales {
    t: svs.util.IScale;
    v: svs.util.IScale;
    i: svs.util.IScale;
  }

  /** Holds the tick values of a graphs axis */
  export interface IValues {
    [name: string]: number[];
  }

  /**
   * Generate about n evenly-spaced ticks between domain = [min, max] (method from d3.js) found at:
   * http://stackoverflow.com/questions/8855026/generate-axis-scale
   */
  function getTicks(domain: number[], n: number): number[] {
    var min = domain[0];
    var max = domain[1];
    var delta = max - min;
    var step = Math.pow(10, Math.floor(Math.log(delta / n) / Math.LN10));
    var error = n / delta * step;

    if (error <= .15) {
      step *= 10;
    } else if (error <= .35) {
      step *= 5;
    } else if (error <= .75) {
      step *= 2;
    }

    var tstart = Math.ceil(min / step) * step;
    var tstop = Math.floor(max / step) * step + step * .5;
    var ticks: number[] = [];
    for (var i: number = tstart; i < tstop; i += step) {
      ticks.push(i);
    }
    return ticks;
  }

  /** Treat X or Y ranges that span less than epsilon as 0 */
  var epsilon = 1e-12;
  var margin = 5;

  /** Colors for Traces */
  var colors = svs.util.colors;

  /** larger margin for traces, added at top/bottom so they don't "stick" to the edge of the graph. */
  var traceYMargin = 25;

  var nullScale = svs.util.scale(0, 0, 0, 0);

  /**
   * Creates the graph by loading spice data and creating Trace, Cursor, and Axes.
   */
  export class Graph {
    public traces: ITrace[];
    public traces_graph: ITrace[];
    public stack: svs.canvas.Stack;
    private layer: svs.canvas.Layer;
    private overlay: svs.canvas.Layer;
    private output: svs.spice.IOutput;
    private scales: IScales;
    private tween: TWEEN.Tween;

    constructor() {
      this.output = null;
      this.scales = { t: null, v: null, i: null };
      this.tween = null;
      this.traces = [];
      this.traces_graph = [];
    }

    public initView(container: HTMLElement) {
      this.stack = new svs.canvas.Stack(container, false, false);
      this.layer = this.stack.addLayer();
      this.overlay = this.stack.addLayer();
      this.rescale();
      this.layer.addEventListener("layerResize", this.rescale.bind(this));
    }

    public load(output: svs.spice.IOutput) {
      this.output = output;
      var plot = output.plots[0];

      var timeValue: { [name: string]: number; } = { time: plot.values.time[0] };

      // TODO reset stack zoom level/scroll offset
      this.layer.clear();
      this.layer.add(new Axes(plot.values, this.scales));
      this.overlay.clear();
      this.overlay.add(new Cursor(timeValue, this.scales));
      this.traces = [];
      this.traces_graph = [];

      // FIXME Show in UI
      // "Simulation Title: " + output.title;
      // "Simulation Date: " + output.date;
      // output.plots[0].variables;

      var push = true
      plot.variables.forEach(function (v: svs.spice.IVariable, i: number) {
        var type = svs.spice.getVariableType(v);
        var trace = new Trace(v, plot.values.time, plot.values[v.name], this.scales, colors[i % colors.length]);
        if (push){
          this.traces.push({ name: "const", type, variable: v, trace, enabled: true });
          push = false
        }

        if (type === "v" || type === "i") {
          // Show voltages by default, but not currents
          if (type === "v") {
            this.traces.push({ name: v.name, type, variable: v, trace, enabled: true });
            this.traces_graph.push({ name: v.name, type, variable: v, trace, enabled: true });
            this.layer.add(trace);
          } else {
            this.traces.push({
              enabled: false,
              name: v.name.replace(/^i\(@([^)]*)\)/, "$1"),
              trace,
              type,
              variable: v,
            });
            this.traces_graph.push({
              enabled: false,
              name: v.name.replace(/^i\(@([^)]*)\)/, "$1"),
              trace,
              type,
              variable: v,
            });
          }
        }
      }, this);

      // Sort traces by type (reversed), then name (so voltages come first).
      this.traces.sort(function (a, b) {
        if (a.type !== b.type && a.name != "const") {
          return a.type > b.type ? -1 : 1;
        }
        else if(a.name != "const"){
          return a.name > b.name ? 1 : a.name < b.name ? -1 : 0; 
        }
        return 1 
      });

      this.rescale();

      // FIXME should be synced with animation tween. Also we're leaking tweens.
      var overlay = this.overlay;
      TWEEN.remove(this.tween);
      this.tween = new TWEEN.Tween(timeValue).to({ time: plot.values.time }, 10000).repeat(Infinity);
      this.tween.onUpdate(function () { overlay.redraw(); });
      this.tween.start();
    }

    // Update the scales. This creates new scales and assignes them to the
    // properties of the 'scales' object. Therefore, we always pass this object
    // around even if we need only one of the scales.
    public rescale() {
      var layer = this.layer;
      var output = this.output;
      var scales = this.scales;
      var traces = this.traces;

      if (output) {

        // Build T scale
        var time = output.plots[0].variables[0];
        var delta = time.max - time.min;

        if (Math.abs(delta) >= epsilon) {
          scales.t = svs.util.scale(time.min, time.max, margin, (layer.canvas.width - margin));
        } else {
          scales.t = nullScale;
        }

        // Build V scale
        var activeVoltages: svs.spice.IVariable[] = traces.filter(function (t) {
          return t.enabled && svs.spice.getVariableType(t.variable) === "v";
        }).map(function (t) {
          return t.variable;
        });
        if (activeVoltages.length > 0) {
          var maxY = activeVoltages.map(function (v) {
            return v.max;
          }).reduce(function (a, b) {
            return Math.max(a, b);
          });
          var minY = activeVoltages.map(function (v) {
            return v.min;
          }).reduce(function (a, b) {
            return Math.min(a, b);
          });
          delta = maxY - minY;
          if (Math.abs(delta) < epsilon) {
            // Scale from -1 to +1 for values close to 0
            if (Math.abs(minY) < 2 * epsilon) {
              minY = -1;
              maxY = 1;
            } else {
              minY *= minY > 0 ? 0.9 : 1.1;
              maxY *= maxY > 0 ? 1.1 : 0.9;
            }
          }
          scales.v = svs.util.scale(minY, maxY, (layer.canvas.height - traceYMargin), traceYMargin);
        } else {
          scales.v = nullScale;
        }

        // Build I scale
        var activeCurrents: svs.spice.IVariable[] = traces.filter(function (t) {
          return t.enabled && svs.spice.getVariableType(t.variable) === "i";
        }).map(function (t) {
          return t.variable;
        });
        if (activeCurrents.length > 0) {
          var maxY = activeCurrents.map(function (v) {
            return v.max;
          }).reduce(function (a, b) {
            return Math.max(a, b);
          });
          var minY = activeCurrents.map(function (v) {
            return v.min;
          }).reduce(function (a, b) {
            return Math.min(a, b);
          });
          delta = maxY - minY;
          if (Math.abs(delta) < epsilon) {
            // Scale from -1 to +1 for values close to 0
            if (Math.abs(minY) < 2 * epsilon) {
              minY = -1;
              maxY = 1;
            } else {
              minY *= minY > 0 ? 0.9 : 1.1;
              maxY *= maxY > 0 ? 1.1 : 0.9;
            }
          }
          scales.i = svs.util.scale(minY, maxY, (layer.canvas.height - traceYMargin), traceYMargin);
        } else {
          scales.i = nullScale;
        }

      } else {
        scales.t = nullScale;
        scales.v = nullScale;
        scales.i = nullScale;
      }
    }

    public toggleTrace(i: number, enabled: boolean) {
      this.traces[i].enabled = enabled;
      if (enabled) {
        this.layer.add(this.traces[i].trace);
      } else {
        this.layer.remove(this.traces[i].trace);
      }
      this.rescale();
    }
  }

  /** The drawing representation of a simulated signal. */
  export class Trace extends svs.canvas.Shape {
    public variable: svs.spice.IVariable;
    public color: string;
    public time: number[];
    public values: number[];
    private type: string;
    private scales: IScales;

    constructor(variable: svs.spice.IVariable, time: number[], values: number[], scales: IScales, color: string) {
      super({ x: 0, y: 0 });
      this.variable = variable;
      this.time = time;
      this.values = values;
      this.scales = scales;
      this.color = color;
      this.type = svs.spice.getVariableType(variable);
    }

    public draw(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      if (this.type === "i") {
        ctx.setLineDash([5, 5]);
      }
      var yScale = this.scales[<keyof IScales>this.type];
      ctx.moveTo(this.scales.t(this.time[0]), yScale(this.values[0]));
      for (var i = 1; i < this.values.length; i++) {
        ctx.lineTo(this.scales.t(this.time[i]), yScale(this.values[i]));
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Draws the moving time cursor. */
  class Cursor extends svs.canvas.Shape {
    public values: { [name: string]: number };
    private scales: IScales;
    private canvas: any;

    constructor(values: { [name: string]: number }, scales: IScales) {
      super({ x: 0, y: 0 });
      this.values = values;
      this.scales = scales;
      this.canvas = null; // To cache canvas instance between redraws
    }

    public draw(ctx: CanvasRenderingContext2D) {
      if (!this.canvas) {
        this.canvas = this.getLayer().canvas;
      }
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(this.scales.t(this.values.time), margin, 2, this.canvas.height - margin);
      ctx.restore();
    }
  }

  /** Draws the axes with labels and ticks. */
  class Axes extends svs.canvas.Shape {
    public values: IValues;
    private scales: IScales;

    constructor(values: IValues, scales: IScales) {
      super({ x: 0, y: 0 });
      this.values = values;
      this.scales = scales;
    }

    public draw(ctx: CanvasRenderingContext2D) {
      ctx.save();
      var canvas = this.getLayer().canvas;
      var origin = { x: 0 + margin, y: canvas.height - margin };

      // TODO hide left or right axis if no voltage/current trace is active.

      // Draw X axis
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(canvas.width - margin, origin.y);
      ctx.lineTo(canvas.width - margin - 4, origin.y - 4);
      ctx.moveTo(canvas.width - margin, origin.y);
      ctx.lineTo(canvas.width - margin - 4, origin.y + 4);

      // Draw left Y axis (voltage)
      if (this.scales.v !== nullScale) {
        // Arrow
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(origin.x, 0 + margin);
        ctx.lineTo(origin.x - 4, 0 + margin + 4);
        ctx.moveTo(origin.x, 0 + margin);
        ctx.lineTo(origin.x + 4, 0 + margin + 4);
      }

      // Draw right Y axis (current)
      if (this.scales.i !== nullScale) {
        ctx.moveTo(canvas.width - margin, origin.y);
        ctx.lineTo(canvas.width - margin, 0 + margin);
        ctx.lineTo(canvas.width - margin - 4, 0 + margin + 4);
        ctx.moveTo(canvas.width - margin, 0 + margin);
        ctx.lineTo(canvas.width - margin + 4, 0 + margin + 4);
      }

      ctx.strokeStyle = "#333";
      ctx.fillStyle = "#333";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "12px sans-serif";

      // Draw left Y axis label
      if (this.scales.v !== nullScale) {
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.fillText("v [V]", origin.x + 8, 0 + margin);
      }

      // Draw right Y axis label
      if (this.scales.i !== nullScale) {
        ctx.textBaseline = "top";
        ctx.textAlign = "right";
        ctx.fillText("i [A]", canvas.width - 16, 0 + margin);
      }

      // Draw X axis label
      ctx.textBaseline = "bottom";
      ctx.textAlign = "right";
      ctx.fillText("t [s]", canvas.width - margin - 8, origin.y - 8);

      var nYTicks = Math.round(canvas.height / 40);

      // Draw left Y Ticks
      if (this.scales.v !== nullScale) {
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        var ticks = getTicks(this.scales.v.from, nYTicks);

        ctx.save();
        ctx.beginPath();
        ticks.forEach(function (t: number) {
          var y = Math.round(this.scales.v(t));
          // Don't draw over other axis ticks/axis label.
          if (y < 20 || y > canvas.height - 20) {
            return;
          }
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
          ctx.moveTo(origin.x + 5, y);
          ctx.lineTo(canvas.width - margin, y);
        }, this);
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ticks.forEach(function (t: number) {
          var y = Math.round(this.scales.v(t));
          // Don't draw over other axis ticks/axis label.
          if (y < 20 || y > canvas.height - 20) {
            return;
          }
          ctx.moveTo(origin.x, y);
          ctx.lineTo(origin.x + 5, y);
          ctx.fillText(svs.util.numberToString(t, 2), origin.x + 8, y);
        }, this);
        ctx.stroke();
      }

      // Draw right Y Ticks
      if (this.scales.i !== nullScale) {
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        var ticks = getTicks(this.scales.i.from, nYTicks);

        // Only draw 2nd Y axis lines if this is the only Y axis
        if (this.scales.v === nullScale) {
          ctx.save();
          ctx.beginPath();
          ticks.forEach(function (t: number) {
            var y = Math.round(this.scales.i(t));
            // Don't draw over other axis ticks/axis label.
            if (y < 20 || y > canvas.height - 20) {
              return;
            }
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
            ctx.moveTo(canvas.width - 10, y);
            ctx.lineTo(margin, y);
          }, this);
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ticks.forEach(function (t: number) {
          var y = Math.round(this.scales.i(t));
          // Don't draw over other axis ticks/axis label.
          if (y < 20 || y > canvas.height - 20) {
            return;
          }
          ctx.moveTo(canvas.width - 5, y);
          ctx.lineTo(canvas.width - 10, y);
          ctx.fillText(svs.util.numberToString(t, 2), canvas.width - 18, y);
        }, this);
        ctx.stroke();
      }

      // Draw X Ticks
      var nXTicks = Math.round(canvas.width / 100);
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      var ticks = getTicks(this.scales.t.from, nXTicks);

      ctx.save();
      ctx.beginPath();
      ticks.forEach(function (t: number) {
        var x = Math.round(this.scales.t(t));
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.moveTo(x, origin.y - 5);
        ctx.lineTo(x, margin);
      }, this);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ticks.forEach(function (t: number) {
        var x = Math.round(this.scales.t(t));
        // Don't draw over other axis ticks/axis label.
        if (x < 20 || x > canvas.width - 20) {
          return;
        }
        ctx.moveTo(x, origin.y);
        ctx.lineTo(x, origin.y - 5);
        ctx.fillText(svs.util.numberToString(t, 2), x, origin.y - 8);
      }, this);
      ctx.stroke();

      ctx.restore();
    }
  }

}
