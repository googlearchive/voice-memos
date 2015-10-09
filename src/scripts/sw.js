/**
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

importScripts('third_party/serviceworker-cache-polyfill.js');

var CACHE_NAME = 'voicememo';
var CACHE_VERSION = '@VERSION@';

self.oninstall = function(event) {

  var urls = [

    '/',
    '/images/chrome-touch-icon-192x192.png',
    '/images/chrome-touch-icon-384x384.png',
    '/images/ic_add_24px.svg',
    '/images/ic_arrow_back_24px.svg',
    '/images/ic_close_24px.svg',
    '/images/ic_delete_24px.svg',
    '/images/ic_delete_white_24px.svg',
    '/images/ic_done_24px.svg',
    '/images/ic_feedback_24px.svg',
    '/images/ic_file_download_24px.svg',
    '/images/ic_info_outline_24px.svg',
    '/images/ic_menu_24px.svg',
    '/images/ic_mic_24px.svg',
    '/images/ic_mode_edit_24px.svg',
    '/images/ic_pause_24px.svg',
    '/images/ic_play_arrow_24px.svg',
    '/images/ic_restore_24px.svg',
    '/images/icon-sessions.svg',
    '/images/side-nav-bg@2x.jpg',
    '/images/superfail.svg',

    '/scripts/voicememo-core.js',
    '/scripts/voicememo-details.js',
    '/scripts/voicememo-list.js',
    '/scripts/voicememo-record.js',

    '/styles/voicememo-core.css',
    '/styles/voicememo-details.css',
    '/styles/voicememo-edit.css',
    '/styles/voicememo-list.css',
    '/styles/voicememo-record.css',

    '/third_party/Recorderjs/recorder.js',
    '/third_party/Recorderjs/recorderWorker.js',
    '/third_party/Recorderjs/wavepcm.js',
    '/third_party/moment.min.js',

    '/third_party/Roboto/Roboto-400.woff',
    '/third_party/Roboto/Roboto-500.woff',

    '/favicon.ico',
    '/manifest.json'

  ];

  urls = urls.map(function(url) {
    return new Request(url, {credentials: 'include'});
  });

  event.waitUntil(
    caches
      .open(CACHE_NAME + '-v' + CACHE_VERSION)
      .then(function(cache) {
        return cache.addAll(urls);
      })
  );

};

self.onactivate = function(event) {

  var currentCacheName = CACHE_NAME + '-v' + CACHE_VERSION;
  caches.keys().then(function(cacheNames) {

    return Promise.all(
      cacheNames.map(function(cacheName) {
        if (cacheName.indexOf(CACHE_NAME) == -1) {
          return;
        }

        if (cacheName != currentCacheName) {
          return caches.delete(cacheName);
        }
      })
    );
  });

};

self.onfetch = function(event) {

  var request = event.request;
  var url = new URL(request.url);
  var validSubsections = [
    'create', 'details', 'edit', ''
  ];

  var subsection = /^\/([^\/]*)/.exec(url.pathname)[1];

  event.respondWith(

    // Check the cache for a hit.
    caches.match(request).then(function(response) {

      // If we have a response return it.
      if (response)
        return response;

      // Otherwise return index.html file.
      if (validSubsections.indexOf(subsection) >= 0)
        return caches.match('/');

      // We may get requests for analytics so
      // do a very dumb check for that.
      if (url.host.indexOf('voice') === -1)
        return fetch(request);

      // And worst case we fire out a not found.
      return new Response('Sorry, not found');
    })
  );
};
