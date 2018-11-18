在Node中，如何用子进程模块完成一个有交互的命令？

    代码如下

    const cp = require('child_process');

    const child = cp.spawn('ls');

    child.stdout.on('data',(data)=>{
        console.log(data.toString());
    });
    //输出当前文件夹下的文件名

    child.on('error',(error)=>{
        console.log(error);
    })

但如果有一个命令需要执行后再次输入比如密码之类的子命令，应该如何通过该模块实现？或者不通过该模块如何实现？


NodeJs是一个单进程的语言，不能像Java那样可以创建多线程来并发执行。当然在大部分情况下，NodeJs是不需要并发执行的，因为它是事件驱动性永不阻塞。但单进程也有个问题就是不能充分利用CPU的多核机制，根据前人的经验，可以通过创建多个进程来充分利用CPU多核，并且Node通过了child_process模块来创建完成多进程的操作。

child_process模块给予node任意创建子进程的能力，node官方文档对于child_proces模块给出了四种方法，映射到操作系统其实都是创建子进程。但对于开发者而已，这几种方法的api有点不同


child_process.exec(command[, options][, callback]) 启动 
子进程来执行shell命令,可以通过回调参数来获取脚本shell执行结果
child_process.execfile(file[, args][, options][, callback]) 
与exec类型不同的是，它执行的不是shell命令而是一个可执行文件
child_process.spawn(command[, args][, options])仅仅执行一个shell命令，不需要获取执行结果
child_process.fork(modulePath[, args][, options])可以用node 
执行的.js文件，也不需要获取执行结果。fork出来的子进程一定是node进程
exec()与execfile()在创建的时候可以指定timeout属性设置超时时间，一旦超时会被杀死 
如果使用execfile()执行可执行文件，那么头部一定是#!/usr/bin/env node

进程间通信
node 与 子进程之间的通信是使用IPC管道机制完成。如果子进程 
也是node进程(使用fork)，则可以使用监听message事件和使用send()来通信。

main.js

var cp = require('child_process');
//只有使用fork才可以使用message事件和send()方法
var n = cp.fork('./child.js');
n.on('message',function(m){
  console.log(m);
})

n.send({"message":"hello"});
1
2
3
4
5
6
7
8
9
child.js

var cp = require('child_process');
process.on('message',function(m){
 console.log(m);
})
process.send({"message":"hello I am child"})
1
2
3
4
5
6
父子进程之间会创建IPC通道，message事件和send()便利用IPC通道通信.

句柄传递
学会如何创建子进程后，我们创建一个HTTP服务并启动多个进程来共同 
做到充分利用CPU多核。 
worker.js

var http = require('http');
http.createServer(function(req,res){
  res.end('Hello,World');
  //监听随机端口
}).listen(Math.round((1+Math.random())*1000),'127.0.0.1');
1
2
3
4
5
main.js

var fork = require('child_process').fork;
var cpus = require('os').cpus();
for(var i=0;i<cpus.length;i++){
  fork('./worker.js');
}
1
2
3
4
5
上述代码会根据你的cpu核数来创建对应数量的fork进程，每个进程监听一个随机端口来提供HTTP服务。

上述就完成了一个典型的Master-Worker主从复制模式。在分布式应用中用于并行处理业务，具备良好的收缩性和稳定性。这里需要注意，fork一个进程代价是昂贵的，node单进程事件驱动具有很好的性能。此例的多个fork进程是为了充分利用CPU的核，并非解决并发问题. 
上述示例有个不太好的地方就是占有了太多端口，那么能不能对于多个子进程全部使用同一个端口从而对外提供http服务也只是使用这一个端口。尝试将上述的端口随机数改为8080，启动会发现抛出如下异常。

events.js:72
        throw er;//Unhandled 'error' event
Error:listen EADDRINUSE
XXXX
抛出端口被占有的异常，这意味着只有一个worker.js才能监听8080端口，而其余的会抛出异常。 
如果要解决对外提供一个端口的问题，可以参考nginx反向代理的做法。对于Master进程使用80端口对外提供服务，而对于fork的进程则使用随机端口，Master进程接受到请求就将其转发到fork进程中

对于刚刚所说的代理模式，由于进程每收到一个连接会使用掉一个文件描述符，因此代理模式中客户端连接到代理进程，代理进程再去连接fork进程会使用掉两个文件描述符，OS中文件描述符是有限的，为了解决这个问题，node引入进程间发送句柄的功能。 
在node的IPC进程通讯API中，send(message，[sendHandle])的第二个参数就是句柄。 
句柄就是一种标识资源的引用，它的内部包含了指向对象的文件描述符。句柄可以用来描述一个socket对象，一个UDP套接子，一个管道 
主进程向工作进程发送句柄意味着当主进程接收到客户端的socket请求后则直接将这个socket发送给工作进程，而不需要再与工作进程建立socket连接，则文件描述符的浪费即可解决。我们来看示例代码: 
main.js

var cp = require('child_process');
var child = cp.fork('./child.js');
var server = require('net').createServer();
//监听客户端的连接
server.on('connection',function(socket){
  socket.end('handled by parent');
});
//启动监听8080端口
server.listen(8080,function(){
//给子进程发送TCP服务器(句柄)
  child.send('server',server);
});
1
2
3
4
5
6
7
8
9
10
11
12
13
child.js


process.on('message',function(m,server){
  if(m==='server'){
    server.on('connection',function(socket){
      socket.end('handle by child');
    });
  }
});
1
2
3
4
5
6
7
8
9
使用telnet或curl都可以测试:

wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
handled by parent
wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
handle by child
wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
handled by parent
wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
handled by parent
1
2
3
4
5
6
7
8
测试结果是每次对于客户端的连接，有可能父进程处理也有可能被子进程处理。现在我们尝试仅提供http服务，并且为了让父进程更加轻量，仅让父进程传递句柄给子进程而不做请求处理:

main.js

var cp = require('child_process');
var child1 = cp.fork('./child.js');
var child2 = cp.fork('./child.js');
var child3 = cp.fork('./child.js');
var child4 = cp.fork('./child.js');
var server = require('net').createServer();
//父进程将接收到的请求分发给子进程
server.listen(8080,function(){
  child1.send('server',server);
  child2.send('server',server);
  child3.send('server',server);
  child4.send('server',server);
  //发送完句柄后关闭监听
  server.close();
});
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
child.js

var http = require('http');
var serverInChild = http.createServer(function(req,res){
 res.end('I am child.Id:'+process.pid);
});
//子进程收到父进程传递的句柄(即客户端与服务器的socket连接对象)
process.on('message',function(m,serverInParent){
  if(m==='server'){
    //处理与客户端的连接
    serverInParent.on('connection',function(socket){
      //交给http服务来处理
      serverInChild.emit('connection',socket);
    });
  }
});
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
当运行上述代码，此时查看8080端口占有会有如下结果:

wang@wang ~/code/nodeStudy $ lsof -i:8080
COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    5120 wang   11u  IPv6  44561      0t0  TCP *:http-alt (LISTEN)
node    5126 wang   11u  IPv6  44561      0t0  TCP *:http-alt (LISTEN)
node    5127 wang   11u  IPv6  44561      0t0  TCP *:http-alt (LISTEN)
node    5133 wang   11u  IPv6  44561      0t0  TCP *:http-alt (LISTEN)
1
2
3
4
5
6
运行curl查看结果:


wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
I am child.Id:5127
wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
I am child.Id:5133
wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
I am child.Id:5120
wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
I am child.Id:5126
wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
I am child.Id:5133
wang@wang ~/code/nodeStudy $ curl 192.168.10.104:8080
I am child.Id:5126