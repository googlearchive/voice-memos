/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Controller from './Controller';
import MemoModel from '../model/MemoModel';
import PubSubInstance from '../libs/PubSub';
import RouterInstance from '../libs/Router';
import DialogInstance from '../libs/Dialog';

export default class RecordController extends Controller {

  constructor () {
    super();

    this.deletePendingRecording = false;
    this.recording = false;
    this.recorder = null;
    this.analyser = null;
    this.view = document.querySelector('.js-record-view');
    this.showViewButton = document.querySelector('.js-new-recording-btn');

    this.volumeReadout = this.view.querySelector('.js-volume-readout');
    this.volumeReadoutCtx = this.volumeReadout.getContext('2d');

    this.volumeReadout.width = 4;
    this.volumeReadout.height = 67;
    this.drawVolumeReadout();

    this.recordCancelButton = this.view.querySelector('.js-record-cancel-btn');
    this.recordStartButton = this.view.querySelector('.js-record-start-btn');
    this.recordStopButton = this.view.querySelector('.js-record-stop-btn');
    this.recordStartButton.disabled = false;
    this.recordStopButton.disabled = true;

    this.recordStartButton.addEventListener('click', () => {
      this.startRecording();
    });

    this.recordStopButton.addEventListener('click', () => {
      this.stopRecording();
    });

    this.recordCancelButton.addEventListener('click', () => {

      this.deletePendingRecording = true;

      RouterInstance().then(router => {
        router.go('/');
      });
    });

    this.loadScript('/third_party/Recorderjs/recorder.js');
    this.loadCSS('/styles/voicememo-record.css')
        .then( () => {

          this.view.classList.remove('hidden');

          RouterInstance().then(router => {
            router.add('create',
                (data) => this.show(data),
                () => this.hide());
          });

          this.showViewButton.addEventListener('click', () => {

            RouterInstance().then(router => {
              router.go('/create');
            });

          });

          if (this.showViewButton.classList.contains('pending')) {
            this.showViewButton.classList.remove('pending');

            RouterInstance().then(router => {
              router.go('/create');
            });
          }

        });

  }

  show () {
    this.view.classList.add('record-view--visible');
    this.recordStartButton.tabIndex = 1;
    this.recordStartButton.focus();
  }

  hide () {
    this.recordStartButton.tabIndex = -1;
    this.stopRecording();

    this.view.classList.remove('record-view--visible');
  }

  drawVolumeReadout (volume) {

    if (!volume)
      volume = 0;

    this.volumeReadoutCtx.save();
    this.volumeReadoutCtx.clearRect(0,0,4,67);
    this.volumeReadoutCtx.translate(0, 63);

    var fillStyle;
    for (var v = 0; v < 10; v++) {

      fillStyle = '#D8D8D8';
      if (v < volume)
        fillStyle = '#673AB7';

      this.volumeReadoutCtx.fillStyle = fillStyle;
      this.volumeReadoutCtx.beginPath();
      this.volumeReadoutCtx.arc(2, 2, 2, 0, Math.PI * 2);
      this.volumeReadoutCtx.closePath();
      this.volumeReadoutCtx.fill();
      this.volumeReadoutCtx.translate(0, -7);
    }

    this.volumeReadoutCtx.restore();
  }

  killStream () {
    if (!this.recorder.stream)
      return;

    if (typeof this.recorder.stream.stop !== 'function')
      return;

    this.recorder.stream.stop();
    this.recorder = null;
  }

  startRecording () {

    if (this.recording)
      return;

    var volumeData = [];
    var volumeMax = 0;
    var volumeSum = 0;
    var transcript = null;
    var recognition = null;

    this.recording = true;

    this.recorder = new Recorder({

      workerPath: 'third_party/Recorderjs/recorderWorker.js',
      recordOpus: false

    });

    this.recorder.addEventListener('dataAvailable', (e) => {

      // recognition.stop()

      if (this.deletePendingRecording) {
        this.deletePendingRecording = false;
        this.killStream();
        return;
      }

      // Normalize volume data
      for (var d = 0; d < volumeData.length; d++) {
        volumeData[d] /= volumeMax;
      }

      var newMemo = new MemoModel({
        audio: e.detail,
        volumeData: volumeData,
        transcript: transcript
      });

      // Now show the form...
      newMemo.put().then( () => {

        PubSubInstance().then(ps => {
          ps.pub(MemoModel.UPDATED);
        });

        // By rights we should show the user something that lets
        // them edit the title, description, etc.
        RouterInstance().then(router => {
          router.go(`/edit/${newMemo.url}`);
        });
      });

      this.killStream();
    });

    var listener = this.recorder.audioContext.createAnalyser();
    var listenerDataSize = 256;
    var listenerData = new Uint8Array(listenerDataSize);
    var trackAudioVolumeBound;

    listener.fftSize = listenerDataSize;
    listener.smoothingTimeConstant = 0;

    var trackAudioVolume = function () {

      volumeSum = 0;
      listener.getByteFrequencyData(listenerData);

      // Offset into the frequencies a bit because it
      // gives better visualization.
      for (var i = 32; i < listenerData.length; i++) {
        volumeSum += listenerData[i];
      }

      var volume = volumeSum / listenerDataSize;
      if (volume > volumeMax)
        volumeMax = volume;

      volumeData.push(volume);
      this.drawVolumeReadout(volume / 3);

      if (!this.recording) {
        this.drawVolumeReadout();
        return;
      }

      requestAnimationFrame(trackAudioVolumeBound);
    }

    trackAudioVolumeBound = trackAudioVolume.bind(this);

    this.recorder.addEventListener('streamReady', () => {

      setTimeout(() => {
        requestAnimationFrame( () => {
          this.recordStopButton.disabled = false;
          this.recordStartButton.disabled = true;
          this.recordStopButton.focus();
        })
      }, 80);

      this.recorder.start();
      this.recorder.sourceNode.connect(listener);
      requestAnimationFrame(trackAudioVolumeBound);

      // if ("webkitSpeechRecognition" in window) {

      //   console.log("Attempting recognition...");

      //   recognition = new webkitSpeechRecognition();
      //   recognition.onresult = (e) => {
      //     console.log(e);
      //     transcript = e.results[0][0];
      //   };

      //   recognition.onerror = (e) => {
      //     console.log(e);
      //   }

      //   recognition.start();
      // }
    });

    this.recorder.addEventListener('streamError', () => {

      DialogInstance()
        .then(dialog => {

          var hideCancelButton = true;

          return dialog.show(
            'Booooo!',
            'There is a problem getting access to the microphone.',
            hideCancelButton);

        })
        .catch( () => {});

    });
  }

  stopRecording () {

    this.recording = false;

    this.recordStopButton.disabled = true;
    this.recordStartButton.disabled = false;

    if (!this.recorder)
      return;

    this.recorder.stop();
  }

}
