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

export default class ListController extends Controller {

  constructor () {
    super();

    this.memos = null;
    this.ctaView = document.querySelector('.js-cta');
    this.view = document.querySelector('.js-list-view');

    Promise.all([
      this.loadCSS('/styles/voicememo-list.css'),
      this.loadScript('/third_party/moment.min.js')
    ])
    .then( () => {
      this.getMemosAndPopulate();

      PubSubInstance().then(ps => {
        ps.sub(MemoModel.UPDATED, () => {
          this.getMemosAndPopulate();
        });
      });

      PubSubInstance().then(ps => {
        ps.sub('list-covered', () => {
          this.view.classList.add('list-view--shrunk');
          this.unsetTabIndexes();
        });
      });

      PubSubInstance().then(ps => {
        ps.sub('list-uncovered', () => {
          this.view.classList.remove('list-view--shrunk');
          this.setTabIndexes();
        });
      });

      PubSubInstance().then(ps => {
        ps.sub('list-locked', () => {
          this.view.classList.add('list-view--locked');
          this.unsetTabIndexes();
        });
      });

      PubSubInstance().then(ps => {
        ps.sub('list-unlocked', () => {
          this.view.classList.remove('list-view--locked');
          this.unsetTabIndexes();
        });
      });

    });
  }

  getMemosAndPopulate () {

    MemoModel.getAll('time', MemoModel.DESCENDING)
      .then(memos => {
        this.memos = memos;
        this.populate();
        this.setTabIndexes();
      });
  }

  populate () {

    if (!this.memos.length) {
      this.ctaView.classList.add('empty-set-cta--visible');
      return;
    }

    this.ctaView.classList.remove('empty-set-cta--visible');
    this.removeEventListeners();

    var list = '<ol class="list-view__contents">';

    this.memos.forEach((memo) => {

      var memoTimeAgo = moment(memo.time).fromNow();

      list += `<li class="list-view__item" id="vm-${memo.url}" data-url="${memo.url}">
                <div class="list-view__item-details">
                  <div class="list-view__item-date">${memoTimeAgo}</div>
                  <div class="list-view__item-title">${memo.title}</div>`

      if (memo.description !== null)
        list += `<div class="list-view__item-description">
                  ${memo.description}
                </div>`

      list += `</div>

              </li>`;
    });
    list += '</ol>';

    this.view.innerHTML = list;
    this.addEventListeners();
  }

  setTabIndexes () {

    if (this.view.classList.contains('list-view--locked'))
      return;

    if (this.view.classList.contains('list-view--shrunk'))
      return;

    var listItems = document.querySelectorAll(
      '.list-view__item'
    );

    for (var l = 0; l < listItems.length; l++) {
      listItems[l].tabIndex = l + 2;
    }
  }

  unsetTabIndexes () {

    var listItems = document.querySelectorAll(
      '.list-view__item'
    );

    for (var l = 0; l < listItems.length; l++) {
      listItems[l].removeAttribute('tabindex');
    }
  }

  addEventListeners () {
    var toggleButtons = document.querySelectorAll(
        '.list-view__item-preview-toggle');

    var listItems = document.querySelectorAll(
        '.list-view__item'
    );

    for (var l = 0; l < listItems.length; l++) {
      listItems[l].addEventListener('keyup', this.onListItemClick);
      listItems[l].addEventListener('click', this.onListItemClick);
    }
  }

  removeEventListeners () {
    var listItems = document.querySelectorAll(
      '.list-view__item'
    );

    for (var l = 0; l < listItems.length; l++) {
      listItems[l].removeEventListener('keyup', this.onListItemClick);
      listItems[l].removeEventListener('click', this.onListItemClick);
    }
  }

  onListItemClick (e) {

    if (e.type == 'keyup' && e.keyCode !== 13)
      return;

    e.target.classList.add('active');

    RouterInstance().then(router => {
      router.go(`/details/${this.dataset.url}`);
    });
  }

  onToggleButtonPress () {
    // get the for attribute, find the audio, set the src
    // when the user clicks stop, we should unhook the audio
    // via revokeObjectURL
  }

}
