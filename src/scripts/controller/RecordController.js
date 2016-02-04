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

/* global MediaRecorder */

import Controller from './Controller';
import MemoModel from '../model/MemoModel';
import PubSubInstance from '../libs/PubSub';
import RouterInstance from '../libs/Router';
import DialogInstance from '../libs/Dialog';
import MediaRecording from '../recording/MediaRecording';

export default class RecordController extends Controller {

  constructor () {
    super();

    this.usesMediaRecorder = ('MediaRecorder' in window);
    this.deletePendingRecording = false;
    this.recording = false;
    this.mediaRecording = null;
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

    // Hide the file size warning if the MediaRecorder API is present.
    if ('MediaRecorder' in window &&
      typeof MediaRecorder.canRecordMimeType === 'undefined') {
      document.querySelector('.record-view__warning').style.display = 'none';
    }

  }

  show () {
    this.view.classList.add('record-view--visible');
    this.recordStartButton.tabIndex = 1;
    this.recordStartButton.focus();
  }

  hide () {
    this.recordStartButton.tabIndex = -1;
    this.stopRecording();
    this.mediaRecording = null;

    this.view.classList.remove('record-view--visible');
  }

  drawVolumeReadout (volume=0) {

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

  startRecording () {

    if (this.recording)
      return;

    let volumeData = [];
    let volumeMax = 1;
    let volumeSum = 0;

    this.recording = true;
    this.mediaRecording = new MediaRecording();
    this.mediaRecording.complete.then(audioData => {

      // Null audio data represents a cancelled recording.
      if (audioData === null)
        return;

      // Normalize volume data
      for (var d = 0; d < volumeData.length; d++) {
        volumeData[d] /= volumeMax;
      }

      var newMemo = new MemoModel({
        audio: audioData,
        volumeData: volumeData
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
    }, err => {

      DialogInstance()
        .then(dialog => {

          var hideCancelButton = true;

          return dialog.show(
            'Booooo!',
            'There is a problem getting access to the microphone.',
            hideCancelButton);

        })
        .then( () => {
          this.deletePendingRecording = true;
          this.stopRecording();
        })
        .catch( () => {});
    })

    setTimeout(() => {
      requestAnimationFrame( () => {
        this.recordStopButton.disabled = false;
        this.recordStartButton.disabled = true;
        this.recordStopButton.focus();
      })
    }, 80);

    this.mediaRecording.analyser.then(analyser => {
      let analyserDataSize = 256;
      let analyserStart = 32;
      let analyserEnd = analyserDataSize;
      let analyserDataRange = analyserEnd - analyserStart;
      let analyserData = new Uint8Array(analyserDataSize);

      analyser.fftSize = analyserDataSize;
      analyser.smoothingTimeConstant = 0.3;

      let trackAudioVolume = () => {

        volumeSum = 0;
        analyser.getByteFrequencyData(analyserData);

        for (let i = analyserStart; i < analyserEnd; i++) {
          volumeSum += analyserData[i];
        }

        let volume = volumeSum / analyserDataRange;
        if (volume > volumeMax)
          volumeMax = volume;

        volumeData.push(volume);
        this.drawVolumeReadout(volume / 10);

        if (!this.recording) {
          this.drawVolumeReadout();
          return;
        }

        requestAnimationFrame(trackAudioVolume);
      }

      requestAnimationFrame(trackAudioVolume);
    });

  }

  stopRecording () {

    this.recording = false;

    this.recordStopButton.disabled = true;
    this.recordStartButton.disabled = false;

    if (!this.mediaRecording)
      return;

    this.mediaRecording.stop(this.deletePendingRecording);
    this.deletePendingRecording = false;
  }

}
