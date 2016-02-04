# Voice Memos

![Voice Memos](https://aerotwist.com/static/blog/voice-memos/grabs.jpg)

A sample web app that lets you record voice memos. It uses ES6 classes (via Babel) and [RecorderJS](https://github.com/chris-rudmin/Recorderjs).

[See the site here](https://voice-memos.appspot.com/)

## Running application locally

1. Clone project.

2. Install this [Google App Engine SDK For Python](https://cloud.google.com/appengine/downloads#Google_App_Engine_SDK_for_Python).

3. Run SDK app to create symlinks for `dev_appserver.py`.

4. Run `npm install` in __voice-memos/__.

  4.1. If you're using node >= 4.0, you should propably run `npm uninstall --save-dev gulp-sass` and then `npm install --save-dev gulp-sass`.

5. Run `gulp` in __voice-memos/__.

6. Run `dev_appserver.py voice-memos/`

7. Enjoy your local version of app :).

## License

Copyright 2015 Google, Inc.

Licensed to the Apache Software Foundation (ASF) under one or more contributor license agreements. See the NOTICE file distributed with this work for additional information regarding copyright ownership. The ASF licenses this file to you under the Apache License, Version 2.0 (the “License”); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an “AS IS” BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Please note: this is not a Google product
