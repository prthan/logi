const axios=require('axios');
const logger=require('./logger');
const utils=require('./utils');

let send={};

send.COLUMN_SIZE=80;
send.TRUNCATE_SIZE=500;

send.exec=(inspection)=>
{
  let impl=async($res, $rej)=>
  {
    let oid=utils.shortid();
    send.logRequest(oid, inspection);

    let options=
    {
      method: inspection.target.method,
      url: inspection.target.endpoint,
    };

    let headers={};
    inspection.request.headers.forEach((item)=>
    {
      if(item.header && item.header!="") headers[item.header]=item.value;
    });
    options.headers=headers;
    options.transformResponse=[];
    if(['PUT', 'POST', 'DELETE', 'PATCH'].includes(inspection.target.method)) options.data=inspection.request.content;
  
    let outcome={startTime: process.hrtime()};
    axios(options)
    .then((res)=>
    {
      outcome.res=res;
      //send.copyRes(res, inspection);
      //send.logResponse(oid, inspection);
      //$res(inspection);
    })
    .catch((err)=>
    {
      if(err.response) outcome.res=err.response; //send.copyRes(err.response, inspection)
      else outcome.err=err; //inspection.response.error=err.message;
      //send.logResponse(oid, inspection);
      //$res(inspection)
    })
    .finally(()=>
    {
      outcome.timeDiff=process.hrtime(outcome.startTime);
      if(outcome.res) send.copyRes(outcome.res, inspection);
      if(outcome.err) inspection.response.error=err.message;
      inspection.response.time=outcome.timeDiff[0]*1000 + outcome.timeDiff[1] / 1000000;
      inspection.response.time=Math.round(inspection.response.time*1000+0.5)/1000;
      send.logResponse(oid, inspection);
      $res(inspection);
    })
  }
  return new Promise(impl);
}

send.copyRes=(res, inspection)=>
{
  inspection.response.status={code: res.status, text: res.statusText};
  inspection.response.content=res.data;

  inspection.response.headers=[];
  Object.keys(res.headers).forEach((header)=>inspection.response.headers.push({header: header, value: res.headers[header]}));
}

send.logRequest=(oid, inspection)=>
{
  logger.info(`[${oid}]`, `inspection : ${inspection.oid}`);
  logger.info(`[${oid}]`, `┌───[ Request ]────────────────────────────────────────────────────────────────────┐`);
  utils.wrapText(`${inspection.target.method} ${inspection.target.endpoint}`, send.COLUMN_SIZE, send.TRUNCATE_SIZE).forEach((line)=>logger.info(`[${oid}]`, '│', line,'│'));
  
  if(inspection.request.headers.length>0)
  {
    logger.info(`[${oid}]`, `├──────────────────────┬───────────────────────────────────────────────────────────┤`); 
    send.logHeaders(oid, inspection.request.headers);
    logger.info(`[${oid}]`, `├──────────────────────┴───────────────────────────────────────────────────────────┤`);  
  }

  if(inspection.target.method!="GET")
  {
    if(inspection.request.headers.length==0)
      logger.info(`[${oid}]`, `├──────────────────────────────────────────────────────────────────────────────────┤`); 
    inspection.request.content.split("\n").forEach(line=>utils.wrapText(line, send.COLUMN_SIZE, send.TRUNCATE_SIZE).forEach((wline)=>logger.info(`[${oid}]`, '│', wline,'│')));
  }
  
  logger.info(`[${oid}]`, `└──────────────────────────────────────────────────────────────────────────────────┘`);  
}

send.logResponse=(oid, inspection)=>
{
  logger.info(`[${oid}]`, `┌───[ Response ]───────────────────────────────────────────────────────────────────┐`);
  utils.wrapText(`${inspection.response.status.code} ${inspection.response.status.text}`, send.COLUMN_SIZE, send.TRUNCATE_SIZE).forEach(line=>logger.info(`[${oid}]`, '│', line,'│'));
  if(inspection.response.headers.length>0)
  {
    logger.info(`[${oid}]`, `├──────────────────────┬───────────────────────────────────────────────────────────┤`);    
    send.logHeaders(oid, inspection.response.headers);
    logger.info(`[${oid}]`, `├──────────────────────┴───────────────────────────────────────────────────────────┤`);  
  }

  if(inspection.response.headers.length==0)
    logger.info(`[${oid}]`, `├──────────────────────────────────────────────────────────────────────────────────┤`); 

  if(inspection.response.content)
  {
    let content=inspection.response.content.replace(/\r/g, "");
    if(content.length>send.TRUNCATE_SIZE) content=content.substr(0, send.TRUNCATE_SIZE);
    content.split("\n").forEach(line=>utils.wrapText(line, send.COLUMN_SIZE).forEach((wline)=>logger.info(`[${oid}]`, '│', wline,'│')));
  }
    
  if(inspection.response.error)
  {
    let content=inspection.response.error.replace(/\r/g, "");
    if(content.length>send.TRUNCATE_SIZE) content=content.substr(0, send.TRUNCATE_SIZE);
    content.split("\n").forEach(line=>utils.wrapText(line, send.COLUMN_SIZE).forEach((wline)=>logger.info(`[${oid}]`, '│', wline,'│')));
  }
  logger.info(`[${oid}]`, `└──────────────────────────────────────────────────────────────────────────────────┘`);  
}

send.logHeaders=(oid, headers)=>
{
  headers.forEach((item, i)=>
  {
    let name=item.header;
    let value=item.value;
    
    let nameWrap=utils.wrapText(name, 20, 200);
    let valueWrap=[];
    if(value instanceof Array) value.forEach((v)=>valueWrap.push(...utils.wrapText(v, 57, 200)));
    else valueWrap.push(...utils.wrapText(value, 57, 200))
    let lim=nameWrap.length > valueWrap.length ? nameWrap.length : valueWrap.length;
    for(let i=0;i<lim;i++)
    {
      logger.info(`[${oid}]`, '│', i<nameWrap.length ? nameWrap[i]:"".padEnd(20), '│', i<valueWrap.length? valueWrap[i]:"".padEnd(57), '│');
    }
  })
}
//└ ┐─ ┘┌├┤ │


module.exports=send;