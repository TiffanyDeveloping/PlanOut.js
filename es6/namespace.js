import Experiment from "./experiment.js";
import Assignment from "./assignment.js";
import { Sample, RandomInteger } from "./ops/random.js";
import { range, isObject, forEach } from "./lib/utils.js";


class DefaultExperiment extends Experiment {
  configureLogger() {
    return;
  }

  setup() {
    this.name = 'test_name';
  }

  log(data) {
    return;
  }

  previouslyLogged() {
    return true;
  }

  assign(params, args) {
    return;
  }
}

class Namespace {

  addExperiment(name, obj, segments) {
    throw "IMPLEMENT addExperiment";
  }

  removeExperiment(name) {
    throw "IMPLEMENT removeExperiment";
  }

  setAutoExposureLogging(value) {
    throw "IMPLEMENT setAutoExposureLogging";
  }

  inExperiment() {
    throw "IMPLEMENT inExperiment";
  }

  get(name, defaultVal) {
    throw "IMPLEMENT get";
  }

  logExposure(extras) {
    throw "IMPLEMENT logExposure";
  }

  logEvent(eventType, extras) {
    throw "IMPLEMENT logEvent";
  }

  requireExperiment() {
    if (!this._experiment) {
      this._assignExperiment();
    }
  }

  requireDefaultExperiment() {
    if (!this._defaultExperiment) {
      this._assignDefaultExperiment();
    }
  }
}

class SimpleNamespace extends Namespace {
  
  constructor(args) {
    super(args);
    this.name = this.getDefaultNamespaceName();
    this.inputs = args;
    this.numSegments = 1;
    this.segmentAllocations = {};
    this.currentExperiments = {};
    this._autoExposureLoggingSet = true;

    this._experiment = null;
    this._defaultExperiment = null;
    this.defaultExperimentClass = DefaultExperiment
    this._inExperiment = false;

    this.setupDefaults();
    this.setup();
    this.availableSegments = range(this.numSegments);

    this.setupExperiments();
  }

  setupDefaults() {
    return;
  }

  setup() {
    throw "IMPLEMENT setup";
  }

  setupExperiments() {
    throw "IMPLEMENT setupExperiments";
  }

  getPrimaryUnit() {
    return this._primaryUnit;
  }

  setPrimaryUnit(value) {
    this._primaryUnit = value;
  }

  addExperiment(name, expObject, segments) {
    var numberAvailable = this.availableSegments.length;
    if (numberAvailable < segments) {
      return false;
    } else if (this.currentExperiments[name] !== undefined) {
      return false;
    }
    var a = new Assignment(this.name);
    a.set('sampled_segments', new Sample({'choices': this.availableSegments, 'draws': segments, 'unit': name}));
    var sample = a.get('sampled_segments');
    for(var i = 0; i < sample.length; i++) {
      this.segmentAllocations[sample[i]] = name;
      this.availableSegments.splice(this.availableSegments.indexOf(sample[i]), 1);
    }
    this.currentExperiments[name] = expObject
    
  }

  removeExperiment(name) {
    if (this.currentExperiments[name] === undefined) {
      return false;
    }

    var segmentsToFree = [];
    forEach(Object.keys(this.segmentAllocations), (cur) => {
      if(this.segmentAllocations[cur] === name) {
        segmentsToFree.push(cur);
      }
    });
    for (var i = 0; i < segmentsToFree.length; i++) {
      var segment = segmentsToFree[i];
      delete this.segmentAllocations[segment];
      this.availableSegments.push(segment);
    }
    delete this.currentExperiments[name];
    return true;
  }

  getSegment() {
    var a = new Assignment(this.name);
    var segment = new RandomInteger({'min': 0, 'max': this.numSegments-1, 'unit': this.inputs[this.getPrimaryUnit()]});
    a.set('segment', segment);
    return a.get('segment');
  }

  _assignExperiment() {
    var segment = this.getSegment();

    if (this.segmentAllocations[segment] !== undefined) {
      var experimentName = this.segmentAllocations[segment];
      var experiment = new this.currentExperiments[experimentName](this.inputs);
      experiment.setName(`${this.getName()}-${experimentName}`);
      experiment.setSalt(`${this.getName()}-${experimentName}`);
      this._experiment = experiment;
      this._inExperiment = experiment.inExperiment();
      if (!this._inExperiment) {
        this._assignDefaultExperiment();
      }
    }
  }

  _assignDefaultExperiment() {
    this._defaultExperiment = new this.defaultExperimentClass(this.inputs);
  }

  defaultGet(name, default_val) {
    super.requireDefaultExperiment();
    return this._defaultExperiment.get(name, default_val);
  }

  getName() {
    return this.name;
  }

  setName(name) {
    this.name = name;
  }

  inExperiment() {
    super.requireExperiment();
    return this._inExperiment;
  }

  setAutoExposureLogging(value) {
    this._autoExposureLoggingSet = value;
    this._defaultExperiment.setAutoExposureLogging(value);
    if (this._experiment) {
      this._experiment.setAutoExposureLogging(value);
    }
  }

  get(name, defaultVal) {
    super.requireExperiment();
    if (!this._experiment) {
      return this.defaultGet(name, defaultVal);
    } else {
      this._experiment.setAutoExposureLogging(this._autoExposureLoggingSet);
      if (this._experiment.experimentParameters().indexOf(name) >= 0) {
        return this._experiment.get(name, this.defaultGet(name, defaultVal));
      } else {
        return this.defaultGet(name, defaultVal)
      }
    }
  }

  logExposure(extras) {
    super.requireExperiment();
    if (!this._experiment) {
      return;
    }
    this._experiment.logExposure(extras);
  }

  logEvent(eventType, extras) {
    super.requireExperiment();
    if (!this._experiment) {
      return;
    }
    this._experiment.logEvent(eventType, extras);

  }

  //helper function to return the class name of the current experiment class
  getDefaultNamespaceName() {
    if (isObject(this) && this.constructor && this !== this.window) {
      var arr = this.constructor.toString().match(/function\s*(\w+)/);
      if (arr && arr.length === 2) {
        return arr[1];
      }
    }
    return "GenericNamespace";
  }
}

export { Namespace, SimpleNamespace }
