const logger=require('../logger');
const utils=require("../utils");
const fs=require("fs");
const http=require('http');
const io=require('socket.io');
const https=require('https');
//const ihubapiconnector=require("../connectors/ihub-api");
const HANDLERS=
[
  require('./handlers/announce'),
  require('./handlers/disconnect')
];
const FILE_TYPE_TAILER=
{
  "wl-log": require("./tailer/wl-log-tailer"),
  "wl-diag-log": require("./tailer/wl-diag-log-tailer"),
  "ihub-log": require("./tailer/ihub-log-tailer")
}

let agent={};

agent["@sockets"]={};
agent.filetailers=[];
agent.logRecords=[];

agent.createServer=()=>
{
  let config=global.config;
  let options = {};
  
  if(config.tls)
  {
    options.key=fs.readFileSync(config.tls.key);
    options.cert=fs.readFileSync(config.tls.cert);
    agent.server=https.createServer(options);
  }
  else
  {
    agent.server=http.createServer(options);
  }

  agent.io=io(agent.server);
  agent.io.on("connection", (socket)=>
  {
    var socid=socket.id;
    agent["@sockets"][socid]=socket;
    logger.info(`new client connection received - ${socid}`);
  
    HANDLERS.forEach((handler)=>
    {
      socket.on(handler.message, socmsg => handler.process(socket, socmsg, agent));
    });
  })  
}

agent.start=()=>
{
  let config=global.config;
  let impl=async(res$, rej$)=>
  {
    agent.createServer();
    agent.server.listen(config.listener.port, config.listener.address, async()=>
    {
      agent.io.attach(agent.server, 
      {
        path: config.context,
        cors: 
        {
          origin: config.origin,
          methods: ["GET", "POST"],
          credentials: true
        }
      });
      logger.info(`Agent started. Listening for requests on ${config.listener.address}:${config.listener.port}`);
      await agent.startConnectors();
      agent.watch();
      res$();
    });
  }

  return new Promise(impl);
}

agent.stop=()=>
{
  let impl=async(res$, rej$)=>
  {
    agent.unwatch();
    await agent.stopConnectors();
    res$();  
  }

  return new Promise(impl);
}

agent.startConnectors=()=>
{
  let config=global.config;
  if(!config.connectors) return;

  let impl=async(res$, rej$)=>
  {
    //if(config.connectors["ihub-api"]) await ihubapiconnector.start(config.connectors["ihub-api"]);
    res$();
  }
  
  return new Promise(impl);
}

agent.stopConnectors=()=>
{
  let config=global.config;
  if(!config.connectors) return;

  let impl=async(res$, rej$)=>
  {
    //if(config.connectors["ihub-api"]) await ihubapiconnector.stop();
    res$();
  }
  
  return new Promise(impl);
}

agent.watch=()=>
{
  logger.info("starting log file watchers");
  global.config["file-sources"].forEach((source)=>
  {
    let Tailer=FILE_TYPE_TAILER[source.type];
    let filetailer=new Tailer(source, agent.handleRecordFromTailer);
    filetailer.start();
    agent.filetailers.push(filetailer);
  })
}

agent.unwatch=()=>
{
  agent.filetailers.forEach((filetailer)=>
  {
    logger.info(`stopping watcher for ${filetailer.options.file}`);
    filetailer.stop();
  })
}

agent.handleRecordFromTailer=(logRecord)=>
{
  logger.debug(`log record received for source ${logRecord.source}`, logRecord);
  //ihubapiconnector.publish(logRecord);
  Object.values(agent["@sockets"]).forEach((socket)=>socket.emit("/logi/log-record", {logRecord: logRecord}));
}

module.exports=agent;