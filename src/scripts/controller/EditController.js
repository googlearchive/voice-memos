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
import ToasterInstance from '../libs/Toaster';

export default class EditController extends Controller {

  constructor () {

    super();

    this.memo = null;

    this.header = document.querySelector('.header');
    this.view = document.querySelector('.js-edit-view');
    this.reveal = document.querySelector('.js-circular-reveal');
    this.panel = this.view.querySelector('.js-edit-panel');
    this.underPanel = document.querySelector('.js-underpanel');

    this.backButton = this.view.querySelector('.js-back');
    this.submitButton = this.view.querySelector('.js-done');

    this.form = this.view.querySelector('.js-edit-view__edit-form');

    this.formTitle = this.form.querySelector('#edit-view__edit-form-title');
    this.formTitleLabel =
        this.form.querySelector('.edit-view__edit-form-title-label');
    this.formDescription =
        this.form.querySelector('#edit-view__edit-form-description');
    this.formDescriptionLabel =
        this.form.querySelector('.edit-view__edit-form-description-label');

    this.loadCSS('/styles/voicememo-edit.css').then( () => {

      this.view.classList.remove('hidden');

      RouterInstance()
          .then(router => {
            router.add('edit',
                (data) => this.show(data),
                () => this.hide());
          });

    });

    // Create bound event listeners, because this will be the event target.
    this.saveAndCloseBound = this.saveAndClose.bind(this);
    this.cancelAndCloseBound = this.cancelAndClose.bind(this);
    this.onFormTitleInputBound = this.onFormTitleInput.bind(this);
    this.onFormDescriptionInputBound = this.onFormDescriptionInput.bind(this);

  }

  show (id) {

    var isOnLargerScreen = window.matchMedia('(min-width: 600px)').matches;

    this.addEventListeners();
    this.setTabIndexes();

    if (!id) {
      RouterInstance().then(router => {
        router.go('/');
      });
      return;
    }

    PubSubInstance().then(ps => {
      ps.pub('list-locked');
    });

    this.underPanel.classList.add('view-underpanel--locked');

    var delayNextViewBy = 420;
    var revealTargetBB = null;
    var revealParentBB = null;
    var revealBB = null;
    var revealFromDetails = document.querySelector(
      '.details-view__panel--visible .js-edit');
    var revealFromRecord = document.querySelector(
      '.record-view--visible .js-record-stop-btn');

    if (revealFromDetails) {
      revealParentBB = document
          .querySelector('.details-view__panel')
          .getBoundingClientRect();

      revealTargetBB = revealFromDetails.getBoundingClientRect();
    } else if (!isOnLargerScreen && revealFromRecord) {
      revealTargetBB = revealFromRecord.getBoundingClientRect();
    }

    var revealBB = this.reveal.getBoundingClientRect();
    var r = Math.sqrt(revealBB.width * revealBB.width +
        revealBB.height * revealBB.height);

    var ex = revealBB.width * 0.5;
    var ey = revealBB.height * 0.5;

    if (!revealTargetBB) {
      this.reveal.style.transform = `translate(-50%, -50%)
              translate(${ex}px, ${ey}px) scale(1)`;
      delayNextViewBy = 0;
    }

    setTimeout( () => {
      this.header.classList.add('header--collapsed');
    }, delayNextViewBy + 50);

    MemoModel.get(id).then(memo => {

      this.memo = memo;

      this.formTitle.value = memo.title;
      this.formDescription.textContent = memo.description;

      this.onFormTitleInput();
      this.onFormDescriptionInput();

      // Now do the reveal.
      if (revealTargetBB) {

        var sx = revealTargetBB.left + revealTargetBB.width * 0.5;
        var sy = revealTargetBB.top + revealTargetBB.height * 0.5;

        // Adjust for any transforms applied to the details panel when we read it.
        if (revealParentBB) {
          sx -= revealParentBB.left;
          sy -= revealParentBB.top;
        }

        this.reveal.classList
            .add('edit-view__circular-reveal--visible');

        this.reveal.style.width = this.reveal.style.height = `${r}px`;
        this.reveal.style.transform = `translate(-50%, -50%)
            translate(${sx}px, ${sy}px) scale(0.001)`;

        var onRevealTransitionComplete = (e) => {

          this.reveal.classList.remove('edit-view__circular-reveal--visible');

          this.reveal.removeEventListener('transitionend',
              onRevealTransitionComplete);

        }

        setTimeout( () => {
          requestAnimationFrame( () => {

            this.reveal.classList
                .add('edit-view__circular-reveal--animatable');

            this.reveal.style.transform = `translate(-50%, -50%)
              translate(${ex}px, ${ey}px) scale(1)`;

            this.reveal.addEventListener('transitionend',
                onRevealTransitionComplete);
          });

        }, 200);
      }

      if (this.memo.title === 'Untitled Memo') {
        this.formTitle.focus();
        this.formTitle.select();
      }

      this.showPanelAndForm();

    });

    return delayNextViewBy;
  }

  showPanelAndForm () {
    this.panel.classList.add('edit-view__panel--visible');
    this.form.classList.add('edit-view__edit-form--animatable');
    this.form.classList.add('edit-view__edit-form--visible');
  }

  hide () {

    PubSubInstance().then(ps => {
      ps.pub('list-unlocked');
    });

    this.underPanel.classList.remove('view-underpanel--locked');
    this.removeEventListeners();
    this.unsetTabIndexes();

    var detailsPanel = document.querySelector('.details-view__panel')
    var revealToDetails = detailsPanel.querySelector('.js-edit');

    var detailsPanelBB = detailsPanel.getBoundingClientRect();
    var revealTargetBB = revealToDetails.getBoundingClientRect();

    var revealBB = this.reveal.getBoundingClientRect();
    var r = Math.sqrt(revealBB.width * revealBB.width +
            revealBB.height * revealBB.height);

    var ex = revealTargetBB.left + revealTargetBB.width * 0.5;
    var ey = revealTargetBB.top + revealTargetBB.height * 0.5;

    // Adjust for any transforms applied to the details panel when we read it.
    ex -= detailsPanelBB.left;
    ey -= detailsPanelBB.top;

    var onRevealTransitionComplete = () => {

      this.reveal.removeEventListener('transitionend',
        onRevealTransitionComplete);

      this.header.classList.remove('header--collapsed');

      this.reveal.style.transform = '';
      this.reveal.classList.remove('edit-view__circular-reveal--visible');
      this.reveal.classList.remove('edit-view__circular-reveal--animatable');
      this.reveal.style.width = '100%';
      this.reveal.style.height = '100%';

      this.memo = null;
    }

    this.reveal.style.width = this.reveal.style.height = `${r}px`;
    this.reveal.classList
              .remove('edit-view__circular-reveal--animatable');
    this.reveal.classList.add('edit-view__circular-reveal--visible');

    this.form.classList.remove('edit-view__edit-form--animatable');
    this.form.classList.remove('edit-view__edit-form--visible');
    this.panel.classList.remove('edit-view__panel--animatable');
    this.panel.classList.remove('edit-view__panel--visible');

    setTimeout( () => {

      this.reveal.classList.add('edit-view__circular-reveal--animatable');
      this.reveal.style.transform = `translate(-50%, -50%)
        translate(${ex}px, ${ey}px) scale(0.001)`;
    }, 300);

    this.reveal.addEventListener('transitionend',
        onRevealTransitionComplete);

  }

  saveAndClose (e) {

    if (e)
      e.preventDefault();

    this.memo.title = this.formTitle.value;
    this.memo.description = this.formDescription.textContent;

    if (this.memo.title.trim() === '')
      this.memo.title = 'Untitled Memo';

    this.memo.put().then( () => {

      PubSubInstance().then(ps => {
        ps.pub(MemoModel.UPDATED);
      });

      RouterInstance().then(router => {
        router.go(`/details/${this.memo.url}`);
      });

      ToasterInstance().then(toaster => {
        toaster.toast('Memo saved.');
      });

    });
  }

  cancelAndClose (e) {

    e.preventDefault();
    RouterInstance().then(router => {
      router.go(`/details/${this.memo.url}`);
    });
  }

  onFormTitleInput () {
    if (this.formTitle.value.length === 0) {
      this.formTitleLabel.classList
          .remove('edit-view__edit-form-title-label--collapsed');
    } else {
      this.formTitleLabel.classList
          .add('edit-view__edit-form-title-label--collapsed');
    }
  }

  onFormDescriptionInput () {
    if (this.formDescription.textContent.length === 0) {
      this.formDescriptionLabel.classList
          .remove('edit-view__edit-form-description-label--collapsed');
    } else {
      this.formDescriptionLabel.classList
          .add('edit-view__edit-form-description-label--collapsed');
    }
  }

  addEventListeners () {
    this.form.addEventListener('submit', this.saveAndCloseBound);
    this.backButton.addEventListener('click', this.cancelAndCloseBound);
    this.formTitle.addEventListener('input', this.onFormTitleInputBound);
    this.formDescription.addEventListener('input',
        this.onFormDescriptionInputBound);
  }

  removeEventListeners () {
    this.form.removeEventListener('submit', this.saveAndCloseBound);
    this.backButton.removeEventListener('click', this.cancelAndCloseBound);
    this.formTitle.removeEventListener('input',
        this.onFormTitleInputBound);
    this.formDescription.removeEventListener('input',
        this.onFormDescriptionInputBound);
  }

  setTabIndexes () {
    this.formTitle.focus();
    this.formTitle.tabIndex = 1;
    this.formDescription.tabIndex = 2;
    this.submitButton.tabIndex = 3;
    this.backButton.tabIndex = 4;
  }

  unsetTabIndexes () {
    this.formTitle.tabIndex = -1;
    this.formDescription.tabIndex = -1;
    this.submitButton.tabIndex = -1;
    this.backButton.tabIndex = -1;
  }

}
