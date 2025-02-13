import md5 from 'md5';

const DEFAULT_PASSWORD = 'admin';

export function isCorrectPassword(pwd : string){
    let hashedPwd = md5(pwd);
    let storedPwd = localStorage.getItem('password');

    if(storedPwd == null){
        storedPwd = md5(DEFAULT_PASSWORD);
        localStorage.setItem('password', storedPwd);
    }

    return hashedPwd == storedPwd;
} 