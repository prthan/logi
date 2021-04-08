(function(window)
{
  let __package = "logi.agent";
  let __name = "Client";

  class AgentClient extends zn.Base
  {
    constructor(options)
    {
      super(options);
    }

    connect()
    {
      let client=this;
      client.socket=io(`${client.options.endpoint}`,{
        path: "/logi/agent",
        withCredentials: true,
        autoConnect: false
      });
      client.socket.on("connect", ()=>
      {
        console.info("[LOGi]", `connected to agent at ${client.options.endpoint}`);
        console.info("[LOGi]", `announcing to agent`);
        client.socket.emit("/logi/announce", {oid: client.options.oid});
      })
      client.socket.on("/logi/announce/ack", (socmsg)=>client.onConnect(socmsg));
      client.socket.on("/logi/log-record", (socmsg)=>client.onLogRecord(socmsg));
      client.socket.connect()
    }

    disconnect()
    {
      let client=this;
      client.socket.disconnect();
    }

    onConnect(info)
    {
      let client=this;
      console.info("[LOGi]", `announcing acknowledged by agent`);
      client.fireEvent("connected", info.sources);
    }

    onLogRecord(socmsg)
    {
      let client=this;
      client.fireEvent("log-record", {logRecord: socmsg.logRecord});
    }

  }
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = AgentClient;  
  
})(window);