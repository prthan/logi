const agent=require("./logi/agent");
const logger=require("./logger");
const fs=require('fs');

let app={};

app.loadConfig=()=>
{
  let data=fs.readFileSync("./config.json");
  global.config=JSON.parse(data);
  console.log(`------ [ ${global.config.name} Configuration ] ------`);
  console.log(global.config);
}

app.main=async()=>
{
  app.loadConfig();
  await agent.start();
}

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
  logger.info("agent shutdown initiated")
  await agent.stop();
  process.exit();
});

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
app.main();
