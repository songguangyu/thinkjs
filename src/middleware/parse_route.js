'use strict';

import url from 'url';

/**
 * route array rules:
 * [
 *   [/^user\/(\d+)/, 'home/user/detail?id=:1'],
 *   [/^usr\/(\d+)/, {
 *     get: 'home/user/detail?id=:1',
 *     post: 'home/user/delete?id=:1'
 *   }],
 *   ...
 * ]
 *
 * route object rules:
 * {
 *   admin: {
 *     reg: /^admin/,
 *     children: [
 *       
 *     ]
 *   }
 * }
 */

export default class extends think.middleware.base {
  /**
   * run
   * @return {Promise} []
   */
  async run(){
    if (!this.config('route_on')) {
      return this.parsePathname();
    }
    let rules = await think.route();
    return this.parse(rules);
  }
  /**
   * parse routes
   * @param  {Array} routes [routes]
   * @return {}        []
   */
  parse(rules){
    this.cleanPathname();
    if(think.isArray(rules)){
      return this.parseRules(rules);
    }
    for(let module in rules){
      let reg = rules[module].reg;
      if(!reg || reg.test(this.http.pathname)){
        this.module = module;
        return this.parseRules(rules[module].children);
      }
    }
    return this.parsePathname();
  }
  /**
   * parse array rules
   * @param  {Array} rules []
   * @return {}       []
   */
  parseRules(rules){
    let length = rules.length;
    let pathname = this.http.pathname;
    if (length === 0 || !pathname) {
      return this.parsePathname();
    }
    let match, item, route, rule;
    for(let i = 0; i < length; i++){
      item = rules[i];
      route = this.getRoute(item[1]);
      if (!route) {
        continue;
      }
      rule = item[0];
      //regexp route
      if (think.isRegExp(rule)) {
        match = pathname.match(rule);
        if (match) {
          return this.parseRegExpRule(match, route);
        }
      }
      //is string route
      else if (this.checkUrlMatch(rule)) {
        return this.parseRoute(route);
      }
    }
    return this.parsePathname();
  }
  /**
   * remove / start | end of pathname
   * @return {} []
   */
  cleanPathname(){
    let pathname = this.http.pathname;
    if (pathname[0] === '/') {
      pathname = pathname.slice(1);
    }
    if (pathname.slice(-1) === '/') {
      pathname = pathname.slice(0, -1);
    }
    this.http.pathname = pathname;
  }
  /**
   * parse pathname
   * @return {} []
   */
  async parsePathname(){
    let pathname = this.http.pathname, http = this.http;
    if (!pathname) {
      this.http.module = this.getModule();
      this.http.controller = this.getController();
      this.http.action = this.getAction();
      return;
    }
    let paths = pathname.split('/');
    let module, controller, action;

    if (think.mode !== think.mode_mini) {
      module = paths[0].toLowerCase();
      if(this.module){
        if(this.module === module){
          paths.shift();
        }else{
          module = this.module;
        }
      }else if (module && module !== think.dirname.common && think.module.indexOf(module) > -1) {
        paths.shift();
      }else{
        module = '';
      }
    }
    controller = paths.shift();
    action = paths.shift();

    this.parseExtPath(paths);

    this.http.module = this.getModule(module);
    this.http.controller = this.getController(controller);
    this.http.action = this.getAction(action);

    if (!this.http.controller) {
      this.http.error = new Error(think.locale('CONTROLLER_INVALID', controller, this.http.url));
      return think.statusAction(400, http);
    }
    if (!this.http.action) {
      this.http.error = new Error(think.locale('ACTION_INVALID', action, this.http.url));
      return think.statusAction(400, http);
    }
  }
  /**
   * parse extra path
   * @param  {Array} paths [extra path]
   * @return {}       []
   */
  parseExtPath(paths){
    if (paths.length === 0) {
      return;
    }
    if (!think.isArray(paths)) {
      if (paths[0] === '/') {
        paths = paths.slice(1);
      }
      paths = paths.split('/');
    }
    for(let i = 0, name, length = Math.ceil(paths.length) / 2; i < length; i++){
      name = paths[i * 2];
      if(name){
        this.http._get[name] = paths[i * 2 + 1] || '';
      }
    }
  }
  /**
   * check url is match
   * @param  {String} rule [url rule]
   * @return {Boolean}      []
   */
  checkUrlMatch(rule){
    let pathname = this.http.pathname.split('/');
    rule = rule.split('/');
    let i = 0, length = rule.length, plength = pathname.length, item, pitem;
    //if rule lenth is more then pathname, it will be false
    if (length > plength) {
      return false;
    }
    let match = {};
    for(; i < length; i++){
      item = rule[i];
      pitem = pathname[i];
      if (item.indexOf(':') === 0) {
        match[item.slice(1)] = pitem;
      }else{
        if (pitem.toLowerCase() !== item.toLowerCase()) {
          return false;
        }
      }
    }
    //append match data to this.http._get
    for(let key in match){
      this.http._get[key] = match[key];
    }
    if (plength > length) {
      this.parseExtPath(pathname.slice(length));
    }
    return true;
  }
  /**
   * get route
   * @param  {Object} route   []
   * @param  {Array} matches []
   * @return {[type]}         []
   */
  getRoute(route){
    if (think.isString(route)) {
      return route;
    }
    for(let method in route){
      if (method.toUpperCase().indexOf(this.http.method) > -1) {
        return route[method];
      }
    }
    return '';
  }
  /**
   * parse route string
   * @param  {String} route []
   * @return {}       []
   */
  parseRoute(route){
    if (route.indexOf('?') > -1) {
      let urlInfo = url.parse(route, true);
      let query = urlInfo.query;
      for(let key in query){
        if (query[key] || !(key in this.http._get)) {
          this.http._get[key] = query[key];
        }
      }
      route = urlInfo.pathname;
    }
    if (route[0] === '/') {
      route = route.slice(1);
    }
    this.http.pathname = route;
    return this.parsePathname();
  }
  /**
   * parse regexp rule
   * @param  {Array} matches  [route matches]
   * @param  {String | Object} route    [route]
   * @return {Boolean}          []
   */
  parseRegExpRule(matches, route){
    //replace :1, :2 in route
    //such as: group/detail?date=:1&groupId=:2&page=:3
    route = route.replace(/:(\d+)/g, (a, b) => (matches[b] || ''));
    let pathname = this.http.pathname.slice(matches[0].length);
    this.parseExtPath(pathname);
    this.parseRoute(route);
  }
  /**
   * check value is lowerCase
   * @param  {String} value []
   * @return {}       []
   */
  checkLowerCase(value){
    // if value has - chars, not check, for REST API
    if(value.indexOf('-') > -1){
      return;
    }
    let lower = value.toLowerCase();
    if(value !== lower){
      think.log(colors => {
        return colors.yellow('[WARNING]') + ` ` + think.locale('URL_HAS_UPPERCASE', value);
      });
    }
  }
  /**
   * get module name
   * @param  {String} module []
   * @return {String}        []
   */
   getModule(module){
    if (!module || think.mode === think.mode_mini) {
      return think.config('default_module');
    }
    this.checkLowerCase(module);
    return module.toLowerCase();
  }
  /**
   * get controller name
   * @param  {String} controller []
   * @return {String}            []
   */
  getController(controller){
    if (!controller) {
      return think.config('default_controller');
    }
    if (/^\w+$/.test(controller)) {
      this.checkLowerCase(controller);
      return controller.toLowerCase();
    }
    return '';
  }
  /**
   * get action
   * @param  {String} action [action name]
   * @return {String}        []
   */
  getAction(action){
    if (!action) {
      return think.config('default_action');
    }
    // action name support `-` char, for REST API
    // /api/system/3b6c279c-bd61-f093-c543-56f9ab4300b7
    if (/^[\w\-]+$/.test(action)) {
      this.checkLowerCase(action);
      return action.toLowerCase();
    }
    return '';
  }
}