function Speak(workerPath, readyCb) {
  this.worker = new Worker(workerPath);
  this.ready = false;
  this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  this.worker.onmessage = function (e) {
    if (e.data !== 'ready') return;
    this.worker.onmessage = null;
    this.worker.addEventListener('message', this);
    this.ready = true;
    if (readyCb) {
      readyCb();
    }
  }.bind(this);
}

Speak.prototype.handleEvent = function (evt) {
  var callback = evt.data.callback;
  if (callback && this[callback]) {
    this[callback].apply(this, evt.data.result);
    if (evt.data.done) delete this[callback];
    return;
  }
};

Speak.prototype.play = function (text, args, onended, onstart) {
  var source = this.audioContext.createBufferSource();
  var worker = this.worker;

  source.stopOld = source.stop;
  source.stop = function () {
    this.stopOld();
    if (this.endTimeout) clearTimeout(this.endTimeout);
  };

  function startSource(source) {
    if (source.start) {
      source.start(0);
    } else {
      source.noteOn(0);
    }
    if (onstart) onstart(source);
  }

  function playSound(streamBuffer) {
    source.connect(this.audioContext.destination);
    this.audioContext.decodeAudioData(streamBuffer, function (audioData) {
      source.buffer = audioData;
      var duration = audioData.duration;
      var delay = duration ? Math.ceil(duration * 1000) : 1000;
      source.endTimeout = setTimeout(onended, delay);
      startSource(source);
    });
  }

  function handleWav(wav) {
    var buffer = new ArrayBuffer(wav.length);
    new Uint8Array(buffer).set(wav);
    playSound(buffer);
  }

  if (args && args.noWorker) {
    var wav = generateSpeech(text, args);
    playSound(wav);
  } else {
    worker.onmessage = function (event) {
      handleWav(event.data);
    };
    worker.postMessage({ text: text, args: args });
  }
};

Speak.prototype.noConflict = function () {
  window.speak = this._speak;
  return this;
};

window.Speak = Speak;
