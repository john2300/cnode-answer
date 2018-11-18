const cp = require('child_process');
let passwords = {
    "admin":"123",
	"user1":"321",
	"user2":"213"
}
const child = cp.spawn('ls');
child.stdin.on('data',(input)=>{

    trim去空格
	input=input.toString().trim();
	if(!username){
        //indexOf返回某个指定的字符串值在字符串中首次出现的位置
		if(Object.keys(users).indexOf(input)===-1){
			child.stdout.write('用户名不存在'+'\n');
			child.stdout.write("请输入用户名:");
			username="";
		}
		else 
		{
			child.stdout.write("请输入密码:");
			username=input;
		}
	}
	//输入密码
	else{
		if(input===users[username]){
            console.log("登陆成功");
            child.stdout.on('data',(data)=>{
                console.log(data.toString());
            });
		}
		else{
			child.stdout.write("请输入密码"+"\n");
		}
		
    }
})
//输出当前文件夹下的文件名

child.on('error',(error)=>{
    console.log(error);
})
// let users={
// 	"admin":"123",
// 	"user1":"321",
// 	"user2":"213"
// };

// let username="";

// process.stdout.write("请输入用户名:");
// process.stdin.on('data',(input)=>{
//     //trim去空格
// 	input=input.toString().trim();
// 	if(!username){
//         //indexOf返回某个指定的字符串值在字符串中首次出现的位置
// 		if(Object.keys(users).indexOf(input)===-1){
// 			process.stdout.write('用户名不存在'+'\n');
// 			process.stdout.write("请输入用户名:");
// 			username="";
// 		}
// 		else 
// 		{
// 			process.stdout.write("请输入密码:");
// 			username=input;
// 		}
// 	}
// 	//输入密码
// 	else{
// 		if(input===users[username]){
// 			console.log("登陆成功");
// 		}
// 		else{
// 			process.stdout.write("请输入密码"+"\n");
// 		}
		
// 	}
// });

