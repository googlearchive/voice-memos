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
import RouterInstance from '../libs/Router';
import PubSubInstance from '../libs/PubSub';
import DialogInstance from '../libs/Dialog';
import ToasterInstance from '../libs/Toaster';

export default class DetailsController extends Controller {

  constructor () {
    super();

    this.memos = null;

    this.header = document.querySelector('.header');
    this.view = document.querySelector('.js-details-view');
    this.reveal = this.view.querySelector('.js-box-reveal');
    this.panel = this.view.querySelector('.js-details-panel');
    this.panelHeader = this.view.querySelector('.js-details-panel-header');
    this.underPanel = document.querySelector('.js-underpanel');

    this.backButton = this.view.querySelector('.js-back');
    this.downloadButton = this.view.querySelector('.js-download');
    this.editButton = this.view.querySelector('.js-edit');
    this.deleteButton = this.view.querySelector('.js-delete');

    this.title = this.view.querySelector('.js-title');
    this.audioPlaybackButton = this.view.querySelector('.js-playback-toggle');
    this.description = this.view.querySelector('.js-description');

    this.audio = document.createElement('audio');
    this.audioPlaying = false;
    this.memoId = null;
    this.volumeData = null;

    this.progressCanvas = this.view.querySelector('.js-playback-progress');
    this.progressCtx = this.progressCanvas.getContext('2d');
    this.progressWidth = 0;
    this.progressHeight = 0;

    this.waveCanvas = this.view.querySelector('.js-wave');
    this.waveCtx = this.waveCanvas.getContext('2d');
    this.waveWidth = 0;
    this.waveHeight = 0;

    this.playbackStarted = 0;
    this.renderPlaybackCanvasBound = this.renderPlaybackCanvas.bind(this);

    this.loadCSS('/styles/voicememo-details.css').then( () => {

      this.view.classList.remove('hidden');

      RouterInstance().then(router => {

        this.configureWaveCanvas();
        window.addEventListener('resize', () => {
          this.configureWaveCanvas();
          this.renderWaveCanvas();
        });

        router.add('details',
            (data) => this.show(data),
            () => this.hide(),
            (data) => this.update(data));

      });

    });

    // Set up event listeners to always be bound to the class.
    this.onAudioEndedBound = this.onAudioEnded.bind(this);
    this.onAudioPlaybackButtonClickBound =
        this.onAudioPlaybackButtonClick.bind(this);
    this.onEditButtonClickBound = this.onEditButtonClick.bind(this);
    this.onBackButtonClickBound = this.onBackButtonClick.bind(this);
    this.onDeleteButtonClickBound = this.onDeleteButtonClick.bind(this);
  }

  releaseAudioURL () {
    if (!this.audio)
      return;

    URL.revokeObjectURL(this.audio.src);
    this.audio.removeAttribute('src');
    this.downloadButton.removeAttribute('href');
  }

  update (id) {
    this.releaseAudioURL();
    this.memoId = id;
    this.populateDetails(id);
  }

  show (id) {

    var viewport600px = window.matchMedia('(min-width: 600px)').matches;
    var viewport960px = window.matchMedia('(min-width: 960px)').matches;
    var cameFromEdit = document.querySelector('.edit-view__panel--visible');

    this.addEventListeners();
    this.setTabIndexes();
    this.view.classList.add('details-view--visible');

    PubSubInstance().then(ps => {
      ps.pub('list-covered');
    });

    this.populateDetails(id).then( () => {

      // Locate the source element
      this.memoId = id;

      var source = document.querySelector('#vm-' + id);

      this.reveal.classList.add('details-view__box-reveal--visible');

      if (source === null || cameFromEdit !== null) {
        this.panel.style.transform = '';
        this.reveal.classList.add('details-view__box-reveal--expanded');
        this.panel.classList.add('details-view__panel--visible');
        this.underPanel.classList.add('view-underpanel--visible');
        this.renderWaveCanvas();
        return;
      }

      // Get all the other list items for animating out of the way.
      var listItems = document.querySelectorAll('.list-view__item');
      var sourceBB = source.getBoundingClientRect();
      var revealBB = this.reveal.getBoundingClientRect();

      if (viewport960px) {
        this.panel.style.transform = 'translateY(50px)';
        this.reveal.style.transform = 'translateY(50px)';
      } else if (viewport600px) {
        this.panel.style.transform = 'translateX(105%)';
        this.reveal.style.transform = 'translateX(105%)';
      } else {
        this.panel.style.transform =
            'translateY(' +
                (sourceBB.top) +
            'px)';

        this.reveal.style.transform =
          'translateY(' +
              (sourceBB.top) +
          'px) scale(1, ' +
              (sourceBB.height / revealBB.height)
          ')';
      }

      // Sometimes we have to wait a while for changes to take hold, so let's
      // give the browser 5ms to do that then go on the next frame. No, I don't
      // think it's great, either.
      setTimeout( () => {

        requestAnimationFrame( () => {

          let onRevealAnimEnd = (e) => {
            this.renderWaveCanvas();
            this.reveal.removeEventListener('transitionend', onRevealAnimEnd);
          }

          this.reveal.addEventListener('transitionend', onRevealAnimEnd);

          this.header.classList.add('header--collapsed');

          this.reveal.classList.add('details-view__box-reveal--animatable');
          this.reveal.classList.add('details-view__box-reveal--expanded');
          this.reveal.style.transform = '';

          this.panel.classList.add('details-view__panel--visible');
          this.panel.classList.add('details-view__panel--animatable');
          this.panel.style.transform = '';

          this.underPanel.classList.add('view-underpanel--visible');

          if (viewport600px)
            return;

          var before = true;
          var translationBefore = sourceBB.top;
          var translationAfter = revealBB.height - sourceBB.top - sourceBB.height;

          for (var i = 0; i < listItems.length; i++) {

            listItems[i].classList.add('list-view__item--animatable');
            if (listItems[i] === source) {
              before = false;
              continue;
            }

            if (before) {
              listItems[i].style.transform =
                'translateY(-' + translationBefore +'px)';
            } else {
              listItems[i].style.transform =
                'translateY(' + translationAfter +'px)';
            }
          }
        });

      }, 5);
    });
  }

  hide () {

    var viewport600px = window.matchMedia('(min-width: 600px)').matches;
    var viewport960px = window.matchMedia('(min-width: 960px)').matches;

    this.view.classList.remove('details-view--visible');
    this.removeEventListeners();
    this.unsetTabIndexes();
    this.releaseAudioURL();

    this.header.classList.remove('header--collapsed');

    this.panel.classList.remove('details-view__panel--visible');
    this.reveal.classList.remove('details-view__box-reveal--expanded');
    this.reveal.classList.add('details-view__box-reveal--animatable');

    requestAnimationFrame( () => {

      var id = this.memoId;
      var source = document.querySelector('#vm-' + id);
      var revealBB = this.reveal.getBoundingClientRect();
      var listItems = document.querySelectorAll('.list-view__item');
      var revealTarget = null;

      if (source)
        revealTarget = source.getBoundingClientRect();
      else
        revealTarget = revealBB;

      if (viewport960px) {
        this.panel.style.transform = 'translateY(50px)';
        this.reveal.style.transform = 'translateY(50px)';
      } else if (viewport600px) {
        this.panel.style.transform = 'translateX(105%)';
        this.reveal.style.transform = 'translateX(105%)';

      } else {
        this.panel.style.transform =
            'translateY(' +
                (revealTarget.top) +
            'px)';

        this.reveal.style.transform =
          'translateY(' +
              (revealTarget.top) +
          'px) scale(1, ' +
              (revealTarget.height / revealBB.height)
          ')';
      }

      var hideElements = (e) => {
        this.reveal.removeEventListener('transitionend', hideElements);
        this.reveal.addEventListener('transitionend', removeRevealTransform);
        this.reveal.classList.remove('details-view__box-reveal--visible');
        this.waveCanvas.classList.remove('details-view__wave--visible');
      }

      var removeRevealTransform = (e) => {
        this.panel.classList.remove('details-view__panel--animatable');

        this.reveal.removeEventListener('transitionend', removeRevealTransform);
        this.reveal.classList.remove('details-view__box-reveal--animatable');
        this.reveal.style.transform = '';
        this.panel.style.transform = '';

        PubSubInstance().then(ps => {
          ps.pub('list-uncovered');
        });
      }

      this.underPanel.classList.remove('view-underpanel--visible');
      this.reveal.addEventListener('transitionend', hideElements);
      this.memoId = null;

      if (viewport960px)
        this.reveal.classList.remove('details-view__box-reveal--visible');

      if (viewport600px)
        return;

      for (var i = 0; i < listItems.length; i++) {
        listItems[i].classList.add('list-view__item--animatable');
        listItems[i].style.transform = '';
      }
    });
  }

  configureWaveCanvas () {

    var dPR = window.devicePixelRatio || 1;

    this.waveWidth = this.waveCanvas.parentElement.offsetWidth;
    this.waveHeight = this.waveCanvas.parentElement.offsetHeight;

    // Scale the backing store by the dPR.
    this.waveCanvas.width = this.waveWidth * dPR;
    this.waveCanvas.height = this.waveHeight * dPR;

    // Scale it back down to the width and height we want in logical pixels.
    this.waveCanvas.style.width = this.waveWidth + 'px';
    this.waveCanvas.style.height = this.waveHeight + 'px';

    // Account for any upscaling by applying a single scale transform.
    this.waveCtx.scale(dPR, dPR);
  }

  configurePlaybackCanvas () {

    var dPR = window.devicePixelRatio || 1;

    this.progressWidth = this.progressCanvas.parentElement.offsetWidth;
    this.progressHeight = this.progressCanvas.parentElement.offsetHeight;

    // Scale the backing store by the dPR.
    this.progressCanvas.width = this.progressWidth * dPR;
    this.progressCanvas.height = this.progressHeight * dPR;

    // Scale it back down to the width and height we want in logical pixels.
    this.progressCanvas.style.width = this.progressWidth + 'px';
    this.progressCanvas.style.height = this.progressHeight + 'px';

    // Account for any upscaling by applying a single scale transform.
    this.progressCtx.scale(dPR, dPR);
  }

  renderWaveCanvas () {

    if (!this.volumeData)
      return;

    this.waveCanvas.classList.add('details-view__wave--visible');

    var padding = 50;
    var maxHeight = this.waveHeight - (2 * padding);

    this.waveCtx.clearRect(0, 0, this.waveWidth, this.waveHeight);
    this.waveCtx.save();
    this.waveCtx.translate(0, this.waveHeight * 0.5);
    this.waveCtx.beginPath();
    this.waveCtx.globalAlpha = 0.2;

    for (var d = 0; d < this.volumeData.length; d++) {
      var x = (d / this.volumeData.length) * this.waveWidth;
      var h = this.volumeData[d] * maxHeight * 0.5;
      h = Math.max(1, h);
      this.waveCtx.lineTo(x, -h);
    }

    for (d = this.volumeData.length - 1; d >= 0; d--) {
      var x = (d / this.volumeData.length) * this.waveWidth;
      var h = this.volumeData[d] * maxHeight * 0.5;
      h = Math.max(1, h);
      this.waveCtx.lineTo(x, h);
    }

    this.waveCtx.closePath();
    this.waveCtx.fill();
    this.waveCtx.restore();
  }

  renderPlaybackCanvas () {

    var duration = this.audio.duration * 1000;
    var position = (Date.now() - this.playbackStarted) / duration;
    var start = -Math.PI * 0.5;

    this.progressCtx.clearRect(0, 0, this.progressWidth, this.progressHeight);
    this.progressCtx.fillStyle = '#F8BBD0';

    this.progressCtx.save();

    this.progressCtx.translate(
      this.progressWidth * 0.5,
      this.progressHeight * 0.5);

    // Progress.
    this.progressCtx.beginPath();
    this.progressCtx.arc(
        0, 0, this.progressWidth * 0.502,
        start, start + position * Math.PI * 2);
    this.progressCtx.lineTo(0, 0);

    this.progressCtx.closePath();
    this.progressCtx.fill();

    // Punch through.
    this.progressCtx.globalCompositeOperation = 'destination-out';
    this.progressCtx.beginPath();
    this.progressCtx.arc(
        0, 0, this.progressWidth * 0.43,
        0, Math.PI * 2);
    this.progressCtx.closePath();
    this.progressCtx.fill();

    this.progressCtx.restore();

    if (this.audioPlaying)
      requestAnimationFrame(this.renderPlaybackCanvasBound);
  }

  populateDetails (id) {

    return MemoModel.get(id).then(memo => {

      this.title.textContent = memo.title;
      this.description.textContent = memo.description || "No description";
      this.volumeData = memo.volumeData;

      this.audio.src = URL.createObjectURL(memo.audio);
      this.downloadButton.href = this.audio.src;
      this.downloadButton.download = memo.title;

      this.configurePlaybackCanvas();

      this.panel.appendChild(this.audio);

    }).catch(e => {

      RouterInstance().then(router => {
        router.go('/');
      });
    })
  }

  onAudioEnded () {
    this.audio.currentTime = 0;
    this.audio.pause();
    this.audioPlaying = false;

    this.playbackStarted = Date.now();
    this.renderPlaybackCanvas();
  }

  onAudioPlaybackButtonClick (e) {

    if (!this.audio)
      return;

    if (this.audioPlaying) {

      this.audio.pause();
      this.audio.currentTime = 0;

    } else {

      this.audio.play();
    }

    this.audioPlaying = !this.audioPlaying;

    this.playbackStarted = Date.now();
    this.renderPlaybackCanvasBound();

  }

  onEditButtonClick (e) {

    RouterInstance().then(router => {
      router.go(`/edit/${this.memoId}`);
    });
  }

  onBackButtonClick (e) {

    RouterInstance().then(router => {
      router.go('/');
    });
  }

  onDeleteButtonClick () {

    DialogInstance()
      .then(dialog => {

        return dialog.show(
          'Delete this memo?',
          'Can\'t get it back if you get rid of it. Just sayin\'.');
      })
      .then( () => {

        // User chose to delete.
        MemoModel.delete(this.memoId).then( () => {

          PubSubInstance().then(ps => {
            ps.pub(MemoModel.UPDATED);
          });

          RouterInstance().then(router => {
            router.go('/');
          });

          ToasterInstance().then(toaster => {
            toaster.toast('Memo deleted.');
          });
        });
      })
      .catch( (e) => { console.warn(e) } );
  }

  addEventListeners () {
    this.audio.addEventListener('ended', this.onAudioEndedBound);
    this.audioPlaybackButton.addEventListener('click',
        this.onAudioPlaybackButtonClickBound);

    this.editButton.addEventListener('click', this.onEditButtonClickBound);
    this.backButton.addEventListener('click', this.onBackButtonClickBound);
    this.deleteButton.addEventListener('click', this.onDeleteButtonClickBound);
  }

  removeEventListeners () {
    this.audio.removeEventListener('ended', this.onAudioEndedBound);
    this.audioPlaybackButton.removeEventListener('click',
        this.onAudioPlaybackButtonClickBound);

    this.editButton.removeEventListener('click', this.onEditButtonClickBound);
    this.backButton.removeEventListener('click', this.onBackButtonClickBound);
    this.deleteButton.removeEventListener('click',
        this.onDeleteButtonClickBound);
  }

  setTabIndexes () {
    this.audioPlaybackButton.tabIndex = 1;
    this.backButton.tabIndex = 2;
    this.deleteButton.tabIndex = 3;
    this.editButton.tabIndex = 4;
    this.downloadButton.tabIndex = 5;

    this.audioPlaybackButton.focus();
  }

  unsetTabIndexes () {
    this.audioPlaybackButton.tabIndex = -1;
    this.backButton.tabIndex = -1;
    this.deleteButton.tabIndex = -1;
    this.editButton.tabIndex = -1;
    this.downloadButton.tabIndex = -1;

  }

}
