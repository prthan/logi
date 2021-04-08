const agent=require("./logi/agent");
const logger=require("./logger");
const fs=require('fs');

let app={};

app.loadConfig=()=>
{
  let data=fs.readFileSync("./config.json");
  global.config=JSON.parse(data);
  app.lastPid=app.getLastPid();
}

app.setupProcess=()=>
{
  let config=global.config;

  process.title=config.name;
  
  process.on('uncaughtException', (err)=>
  {
    logger.error('an unexpected error occured in agent');
    logger.error(err.message);
    logger.error(err.stack);
  });
  
  process.on('SIGINT', async()=>
  {
    logger.info("agent shutdown initiated")
    await agent.stop();
    process.exit();
  });
  
  process.on('SIGTERM', async()=>
  {
    console.info("agent shutdown initiated")
    await agent.stop();
    process.exit();
  });

  fs.writeFileSync(`${config.home}/.agent.pid`, ""+process.pid);
}

app.getLastPid=()=>
{
  try
  {
    let pid=fs.readFileSync(`${config.home}/.agent.pid`);
    return parseInt(pid);
  }
  catch(err)
  {
    return -1;
  }
}

app.isProcessRunning=()=>
{
  if(app.lastPid==-1) return false;

  try
  {
    process.kill(app.lastPid, 0);
    return true;
  }
  catch(err)
  {
    return false;
  }
}

app.startProcess=async()=>
{
  await agent.start();
  logger.info("PID =", process.pid);
}

app.stopProcess=async()=>
{
  if(app.lastPid==-1) return;
  try
  {
    process.kill(app.lastPid, 'SIGTERM');
    console.log(`stop signal sent to process ${app.lastPid}`);
    fs.unlink(`${config.home}/.agent.pid`, (err)=>{});
  }
  catch(err)
  {
    console.log("error occured while stopping stop signal to process ", err.message);
  }
}

app.main=async(params)=>
{
  app.loadConfig();
  if(params.length==0 || params[0]=="start")
  {
    if(!app.isProcessRunning())
    {
      app.setupProcess();
      app.startProcess();
    }
    else console.log(`agent process is already running with pid ${app.lastPid}`);
  }

  if(params.length==1 && params[0]=="stop") app.stopProcess();
}


process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
let params=process.argv.slice(2);

app.main(params);
