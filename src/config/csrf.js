'use strict';

/**
 * csrf configs
 */
export default {
  on: false,
  session_name: '__CSRF__', //name in session
  form_name: '__CSRF__', //name in form
  errno: 400,
  errmsg: 'token error'
};