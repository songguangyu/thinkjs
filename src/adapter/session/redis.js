'use strict';

let RedisSocket = think.adapter('socket', 'redis');

/**
 * redis session
 */
export default class extends think.adapter.base {
  /**
   * init
   * @param  {Object} options []
   * @return {}         []
   */
  init(options){

    this.options = think.extend({}, think.config('session'), options);

    this.timeout = this.options.timeout;
    this.cookie = this.options.cookie;
  }
  /**
   * get redis instance
   * @return {Object} []
   */
  getRedisInstance(name){
    let options = this.parseConfig(think.config('redis'), this.options, {
      command: name,
      from: 'session'
    });
    this.timeout = options.timeout || this.timeout;
    return RedisSocket.getInstance(options, thinkCache.REDIS, ['command', 'from']);
  }
  /**
   * get session
   * @return {Promise} []
   */
  getData(){
    if(this.data){
      return Promise.resolve(this.data);
    }
    let instance = this.getRedisInstance('get');
    return instance.get(this.cookie).then(data => {
      this.data = {};
      try{
        this.data = JSON.parse(data) || {};
      }catch(e){}
      return this.data;
    });
  }
  /**
   * get data
   * @param  {String} name []
   * @return {Promise}      []
   */
  get(name){
    return this.getData().then(() => {
      return !name ? this.data : this.data[name];
    });
  }
  /**
   * set data
   * @param {String} name    []
   * @param {Mixed} value   []
   * @param {Number} timeout []
   */
  set(name, value, timeout){
    if(timeout){
      this.timeout = timeout;
    }
    return this.getData().then(() => {
      this.data[name] = value;
    });
  }
  /**
   * delete data
   * @param  {String} name []
   * @return {Promise}      []
   */
  delete(name){
    return this.getData().then(() => {
      if(name){
        delete this.data[name];
      }else{
        this.data = {};
      }
    });
  }
  /**
   * flush data
   * @return {Promise} []
   */
  flush(){
    return this.getData().then(() => {
      let instance = this.getRedisInstance('set');
      return instance.set(this.cookie, JSON.stringify(this.data), this.timeout);
    });
  }
}