const axios=require('axios');
const logger=require('./logger');
const utils=require('./utils');

let fetch={};

fetch.exec=(req)=>
{
  let impl=async($res, $rej)=>
  {
    let oid=utils.shortid();
    
    let options=
    {
      method: "GET",
      url: req.url,
    };

    logger.info(`[${oid}]`, `fetch : ${req.url}`);
    let outcome={};
    axios(options)
    .then((res)=>
    {
      outcome.res=res;
    })
    .catch((err)=>
    {
      if(err.response) outcome.res=err.response;
      else outcome.err=err;
    })
    .finally(()=>
    {
      let res={};
      if(outcome.res)
      {
        logger.info(`[${oid}]`, `        status: ${outcome.res.status}, ${outcome.res.statusText}`);
        if(outcome.res.status==200)
        {
          res.status={code: outcome.res.status, text: outcome.res.statusText};
          res.content=outcome.res.data;
        }
        else res.error={code: outcome.res.status, message: outcome.res.statusText, details: outcome.res.data};
      }
      if(outcome.err)
      {
        logger.info(`[${oid}]`, `        error: ${outcome.err.message}`);
        res.error={code: -1, message: outcome.err.message};
      }
      $res({res: res, "@agentReqId": req["@agentReqId"]});
    })
  }
  return new Promise(impl);
}


module.exports=fetch;