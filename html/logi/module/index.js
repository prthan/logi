(function(window)
{
  let __package = "logi";
  let __name = "Module";

  class Module
  {
    constructor(options)
    {
      this.options = options;
      this.eventHandlers = {};
    }

    init()
    {
      let module = this;
      
      let impl=async(res$, rej$)=>
      {
        let swreg=await navigator.serviceWorker.register(zn.env.sw);
        console.info("[LOGi]", 'ServiceWorker ==> registered')
        console.info("[LOGi]","module initialized");
        res$();
      }
      console.info("[LOGi]","module initialized");
      //return new Promise(impl);
    }
    
  }

  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = Module;

})(window);

