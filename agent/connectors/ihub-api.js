const logger=require("../logger");
const utils=require("../utils");
const axios=require("axios");

let connector={}

connector.start=(config)=>
{
  logger.info("authenticating with ihub");

  connector.config=config;

  let impl=(res$, rej$)=>
  {
    let request=
    {
      url: config.url+"/api/auth",
      method: "POST",
      headers: {"content-type": "application/json"},
      data: {userid: config.userid, password: config.password}
    }
    let outcome={};
    axios.request(request)
         .then(response => outcome.res=response)
         .catch(err => outcome.err=err)
         .finally(()=>
         {
           if(outcome.res && outcome.res.status==200)
           {
             logger.info("successfully authenitcated with ihub");
             connector.token=outcome.res.data.token;
             logger.debug("auth token: ", connector.token);
             res$();
           }
           else if(outcome.res && outcome.res.status!=200)
           {
             logger.error("ihub authentication failed", outcome.res.data);
             rej$(outcome.res.data);
           }
           else if(outcome.err)
           {
             logger.error("error occured while authenticating with ihub", outcome.err);
             rej$(outcome.err);
           }
         });
  }

  return new Promise(impl);
}

connector.publish$=()=>
{
  let list=[...connector.list];
  connector.list=[];
  
  logger.info(`publishing ${list.length} records to ihub`);
  
  let impl=(res$, rej$)=>
  {
    let request=
    {
      url: connector.config.url+"/api/log-data",
      method: "POST",
      headers: {"content-type": "application/json", "x-zntoken": connector.token},
      data: {list: list}
    }
    let outcome={};
    axios.request(request)
         .then(response => outcome.res=response)
         .catch(err => outcome.err=err)
         .finally(()=>
         {
           if(outcome.res && outcome.res.status==200)
           {
             logger.info("successfully published records to ihub");
             res$();
           }
           else if(outcome.res && outcome.res.status!=200)
           {
             logger.error("error occured while publishing records to ihub", outcome.res.data);
             rej$(outcome.res.data);
           }
           else if(outcome.err)
           {
             logger.error("error occured while publishing records to ihub", outcome.err);
             rej$(outcome.err);
           }
         });
  }

  return new Promise(impl);
}

connector.list=[];
connector.publish=(logRecord)=>
{
  if(!connector.token) return;
  
  logger.info("log record queued for publishing");
  connector.list.push(logRecord);
  if(connector.list.length<100) utils.debounce(connector.publish$, 5000)();
  else connector.publish$();
}

connector.stop=()=>
{

}

module.exports=connector;