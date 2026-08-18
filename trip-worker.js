"use strict";

let crypt = null;
let running = false;


/* =========================================
   複雑キー文字セット
========================================= */

const CHARSET =
    "!@#$%^&*()-_=+[]{};:,.?/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";


const KEY_LENGTH = 8;


/* =========================================
   初期化
========================================= */

try {

    importScripts(
        "./unix-crypt-td.min.js"
    );


    if (
        typeof self.unixCryptTD ===
        "function"
    ) {

        crypt =
            self.unixCryptTD;

    } else if (
        typeof self.z ===
        "function"
    ) {

        crypt =
            self.z;

    } else {

        throw new Error(
            "unixCryptTD が見つかりません"
        );
    }


    self.postMessage({
        type: "ready"
    });


} catch (e) {

    self.postMessage({

        type: "error",

        message:
            e && e.stack
            ? e.stack
            : String(e)
    });
}


/* =========================================
   メッセージ
========================================= */

self.onmessage =
function(event){

    const data =
        event.data || {};


    if(
        data.type === "stop"
    ){

        running = false;

        return;
    }


    if(
        data.type === "test"
    ){

        if(
            typeof crypt !==
            "function"
        ){

            self.postMessage({

                type:"error",

                message:
                    "crypt is not a function"
            });

            return;
        }


        try{

            const trip =
                makeTrip(
                    "!fa4K{0X",
                    10
                );


            self.postMessage({

                type:"test-ok",

                trip:trip
            });


        }catch(e){

            self.postMessage({

                type:"error",

                message:
                    e && e.stack
                    ? e.stack
                    : String(e)
            });
        }


        return;
    }


    if(
        data.type === "search"
    ){

        if(
            typeof crypt !==
            "function"
        ){

            self.postMessage({

                type:"error",

                message:
                    "unixCryptTD unavailable"
            });

            return;
        }


        running = true;

        search(data);

        return;
    }
};


/* =========================================
   Salt
========================================= */

function makeSalt(key){

    const saltCharset =
        "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";


    const value =
        String(key || "A");


    let h1 =
        0x811c9dc5;


    let h2 =
        0x01000193;


    for(
        let i=0;
        i<value.length;
        i++
    ){

        const c =
            value.charCodeAt(i);


        h1 ^= c;


        h1 =
            Math.imul(
                h1,
                16777619
            ) >>> 0;


        h2 ^=
            (c << (i % 8));


        h2 =
            Math.imul(
                h2,
                2246822519
            ) >>> 0;
    }


    const a =
        saltCharset[
            h1 %
            saltCharset.length
        ];


    const b =
        saltCharset[
            h2 %
            saltCharset.length
        ];


    return a + b;
}


/* =========================================
   Trip生成
========================================= */

function makeTrip(
    key,
    length
){

    if(
        typeof crypt !==
        "function"
    ){

        throw new Error(
            "unixCryptTD unavailable"
        );
    }


    key =
        String(key);


    const salt =
        makeSalt(key);


    if(
        Number(length) === 12
    ){

        return generate12(
            key
        );
    }


    const result =
        crypt(
            key,
            salt
        );


    if(
        typeof result !==
        "string"
    ){

        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }


    return result.slice(-10);
}


/* =========================================
   SHA-1
========================================= */

function rotr(x,n){

    return (
        (x >>> n) |
        (x << (32-n))
    ) >>> 0;
}


function sha1Bytes(message){

    const ml =
        message.length;


    const words=[];


    for(
        let i=0;
        i<ml;
        i++
    ){

        words[i>>2] =
            (words[i>>2] || 0) |
            (
                message[i] <<
                (24-(i%4)*8)
            );
    }


    words[ml>>2] =
        (words[ml>>2] || 0) |
        (
            0x80 <<
            (24-(ml%4)*8)
        );


    const totalWords =
        (((ml+8)>>6)+1)*16;


    while(
        words.length <
        totalWords
    ){

        words.push(0);
    }


    words[totalWords-1] =
        ml*8;


    let h0 =
        0x67452301;

    let h1 =
        0xEFCDAB89;

    let h2 =
        0x98BADCFE;

    let h3 =
        0x10325476;

    let h4 =
        0xC3D2E1F0;


    const w =
        new Uint32Array(80);


    for(
        let block=0;
        block<totalWords;
        block+=16
    ){

        for(
            let i=0;
            i<16;
            i++
        ){

            w[i] =
                words[
                    block+i
                ] >>> 0;
        }


        for(
            let i=16;
            i<80;
            i++
        ){

            w[i] =
                rotr(
                    w[i-3]^
                    w[i-8]^
                    w[i-14]^
                    w[i-16],
                    31
                );
        }


        let a=h0;
        let b=h1;
        let c=h2;
        let d=h3;
        let e=h4;


        for(
            let i=0;
            i<80;
            i++
        ){

            let f;
            let k;


            if(i<20){

                f =
                    (b & c) |
                    ((~b) & d);

                k =
                    0x5A827999;

            }else if(i<40){

                f =
                    b ^ c ^ d;

                k =
                    0x6ED9EBA1;

            }else if(i<60){

                f =
                    (b & c) |
                    (b & d) |
                    (c & d);

                k =
                    0x8F1BBCDC;

            }else{

                f =
                    b ^ c ^ d;

                k =
                    0xCA62C1D6;
            }


            const temp =
                (
                    rotr(a,27) +
                    f +
                    e +
                    k +
                    w[i]
                ) >>> 0;


            e=d;
            d=c;
            c=rotr(b,2);
            b=a;
            a=temp;
        }


        h0 =
            (h0+a) >>> 0;

        h1 =
            (h1+b) >>> 0;

        h2 =
            (h2+c) >>> 0;

        h3 =
            (h3+d) >>> 0;

        h4 =
            (h4+e) >>> 0;
    }


    const out =
        new Uint8Array(20);


    const hs=[
        h0,
        h1,
        h2,
        h3,
        h4
    ];


    for(
        let i=0;
        i<5;
        i++
    ){

        out[i*4] =
            hs[i] >>> 24;

        out[i*4+1] =
            hs[i] >>> 16;

        out[i*4+2] =
            hs[i] >>> 8;

        out[i*4+3] =
            hs[i];
    }


    return out;
}


/* =========================================
   Base64
========================================= */

function base64Bytes(bytes){

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789+/";


    let out="";


    for(
        let i=0;
        i<bytes.length;
        i+=3
    ){

        const a =
            bytes[i];


        const b =
            i+1<bytes.length
            ? bytes[i+1]
            : 0;


        const c =
            i+2<bytes.length
            ? bytes[i+2]
            : 0;


        out +=
            chars[a>>2];


        out +=
            chars[
                ((a&3)<<4) |
                (b>>4)
            ];


        out +=
            i+1<bytes.length
            ? chars[
                ((b&15)<<2) |
                (c>>6)
              ]
            : "=";


        out +=
            i+2<bytes.length
            ? chars[c&63]
            : "=";
    }


    return out;
}


/* =========================================
   12桁
========================================= */

function generate12(key){

    const bytes =
        new TextEncoder().encode(
            key
        );


    return base64Bytes(
        sha1Bytes(bytes)
    )
    .slice(0,12)
    .replace(
        /\+/g,
        "."
    );
}


/* =========================================
   検索
========================================= */

function search(data){

    const tripLength =
        Number(data.tripLength) === 12
            ? 12
            : 10;


    const keyLength =
        Number(data.keyLength) ||
        KEY_LENGTH;


    const conditions =
        Array.isArray(
            data.conditions
        )
        ? data.conditions
        : [];


    const special =
        data.special ||
        "none";


    const charset =
        data.charset ||
        CHARSET;


    const start =
        data.start !== undefined
        ? BigInt(data.start)
        : 0n;


    const end =
        data.end !== undefined
        ? BigInt(data.end)
        : null;


    let count=0;


    if(end !== null){

        for(
            let index=start;
            running &&
            index<end;
            index++
        ){

            const key =
                indexToKey(
                    index,
                    keyLength,
                    charset
                );


            let trip;


            try{

                trip =
                    makeTrip(
                        key,
                        tripLength
                    );

            }catch(e){

                self.postMessage({

                    type:"error",

                    message:
                        e && e.message
                        ? e.message
                        : String(e)
                });


                running=false;

                return;
            }


            count++;


            if(
                matchesConditions(
                    trip,
                    conditions
                ) &&
                matchesSpecial(
                    trip,
                    special
                )
            ){

                self.postMessage({

                    type:"hit",

                    key:key,

                    trip:trip
                });
            }


            if(
                (count & 4095) === 0
            ){

                self.postMessage({

                    type:"progress",

                    count:4096
                });


                count=0;
            }
        }

    }else{

        while(running){

            const key =
                randomKey(
                    charset,
                    keyLength
                );


            let trip;


            try{

                trip =
                    makeTrip(
                        key,
                        tripLength
                    );

            }catch(e){

                self.postMessage({

                    type:"error",

                    message:
                        e && e.message
                        ? e.message
                        : String(e)
                });


                running=false;

                return;
            }


            count++;


            if(
                matchesConditions(
                    trip,
                    conditions
                ) &&
                matchesSpecial(
                    trip,
                    special
                )
            ){

                self.postMessage({

                    type:"hit",

                    key:key,

                    trip:trip
                });
            }


            if(
                (count & 2047) === 0
            ){

                self.postMessage({

                    type:"progress",

                    count:2048
                });
            }
        }
    }


    if(count>0){

        self.postMessage({

            type:"progress",

            count:count
        });
    }


    self.postMessage({
        type:"stopped"
    });
}


/* =========================================
   完全探索用キー生成
========================================= */

function indexToKey(
    index,
    length,
    charset
){

    let result="";


    const base =
        BigInt(
            charset.length
        );


    for(
        let i=0;
        i<length;
        i++
    ){

        result =
            charset[
                Number(
                    index % base
                )
            ] +
            result;


        index =
            index / base;
    }


    return result;
}


/* =========================================
   ランダムキー
========================================= */

function randomKey(
    charset,
    length
){

    const result=[];


    const size =
        charset.length;


    const max =
        256 -
        (256 % size);


    while(
        result.length <
        length
    ){

        const buffer =
            new Uint8Array(64);


        crypto.getRandomValues(
            buffer
        );


        for(
            let i=0;
            i<buffer.length &&
            result.length<length;
            i++
        ){

            const value =
                buffer[i];


            if(
                value >= max
            ){

                continue;
            }


            result.push(
                charset[
                    value % size
                ]
            );
        }
    }


    return result.join("");
}


/* =========================================
   通常条件
========================================= */

function matchesConditions(
    trip,
    conditions
){

    for(
        const condition of
        conditions
    ){

        if(!condition){
            continue;
        }


        const text =
            String(
                condition.text ||
                condition.value ||
                ""
            );


        if(!text){
            continue;
        }


        if(
            condition.regex
        ){

            try{

                const re =
                    new RegExp(
                        text
                    );


                if(
                    !re.test(trip)
                ){

                    return false;
                }

            }catch(e){

                return false;
            }


            continue;
        }


        const mode =
            condition.mode ||
            condition.method ||
            "contains";


        if(
            mode === "contains" &&
            !trip.includes(text)
        ){

            return false;
        }


        if(
            mode === "starts" &&
            !trip.startsWith(text)
        ){

            return false;
        }


        if(
            mode === "ends" &&
            !trip.endsWith(text)
        ){

            return false;
        }


        if(
            mode === "exact" &&
            trip !== text
        ){

            return false;
        }
    }


    return true;
}


/* =========================================
   特殊トリップ
========================================= */

function matchesSpecial(
    s,
    type
){

    switch(type){

        case "none":
        case "":
            return true;


        case "pure":
            return pureN(s);


        case "semi":
            return quasiN(s);


        case "two":
            return twoKind(s);


        case "long":
            return /^[MmW]+$/.test(s);


        case "short":
            return /^[li.]+$/.test(s);


        case "yakumo":
            return yakumo(s);


        case "mirror":
            return mirror(s);


        case "palindrome":
            return palindrome(s);


        case "echo":
            return echo(s);


        case "double":
            return doublePair(s);


        case "number":
            return /^[0-9]+$/.test(s);


        case "skip":
            return tobiishi(s);


        case "wideSkip":
            return kakutobi(s);


        default:
            return true;
    }
}


/* =========================================
   純n連
========================================= */

function pureN(s){

    let count=1;


    for(
        let i=1;
        i<s.length;
        i++
    ){

        if(
            s[i] ===
            s[i-1]
        ){

            count++;


            if(
                count >= 8
            ){

                return true;
            }

        }else{

            count=1;
        }
    }


    return false;
}


/* =========================================
   準n連
========================================= */

function quasiN(s){

    let count=1;


    for(
        let i=1;
        i<s.length;
        i++
    ){

        if(
            s[i].toLowerCase() ===
            s[i-1].toLowerCase()
        ){

            count++;


            if(
                count >= 9
            ){

                return true;
            }

        }else{

            count=1;
        }
    }


    return false;
}


/* =========================================
   二構
========================================= */

function twoKind(s){

    return new Set(s).size <= 2;
}


/* =========================================
   八雲
========================================= */

function yakumo(s){

    if(
        s.length < 6
    ){

        return false;
    }


    const groups =
        Math.floor(
            s.length / 3
        );


    if(
        groups < 2
    ){

        return false;
    }


    for(
        let i=0;
        i<groups*3;
        i+=3
    ){

        if(
            s[i] !== s[i+1] ||
            s[i] !== s[i+2]
        ){

            return false;
        }
    }


    return true;
}


/* =========================================
   鏡
========================================= */

function mirror(s){

    const pair={

        ".":".",
        "0":"0",
        "8":"8",

        "A":"A",
        "H":"H",
        "I":"I",
        "M":"M",
        "O":"O",
        "T":"T",
        "U":"U",
        "V":"V",
        "W":"W",
        "X":"X",
        "Y":"Y",

        "b":"d",
        "d":"b",

        "i":"i",
        "l":"l",
        "o":"o",

        "p":"q",
        "q":"p",

        "v":"v",
        "w":"w",
        "x":"x"
    };


    for(
        let i=0;
        i<s.length;
        i++
    ){

        const left =
            s[i];


        const right =
            s[
                s.length-1-i
            ];


        if(
            pair[left] !==
            right
        ){

            return false;
        }
    }


    return true;
}


/* =========================================
   回文
========================================= */

function palindrome(s){

    for(
        let i=0;
        i<Math.floor(s.length/2);
        i++
    ){

        if(
            s[i] !==
            s[
                s.length-1-i
            ]
        ){

            return false;
        }
    }


    return true;
}


/* =========================================
   山彦
========================================= */

function echo(s){

    if(
        s.length % 2 !== 0
    ){

        return false;
    }


    const half =
        s.length / 2;


    return (
        s.substring(0,half) ===
        s.substring(half)
    );
}


/* =========================================
   双連
========================================= */

function doublePair(s){

    if(
        s.length % 2 !== 0
    ){

        return false;
    }


    for(
        let i=0;
        i<s.length;
        i+=2
    ){

        if(
            s[i] !==
            s[i+1]
        ){

            return false;
        }
    }


    return true;
}


/* =========================================
   飛石
========================================= */

function tobiishi(s){

    for(
        let i=1;
        i<s.length;
        i+=2
    ){

        if(
            s[i] !== "." &&
            s[i] !== "/"
        ){

            return false;
        }
    }


    return true;
}


/* =========================================
   拡飛
========================================= */

function kakutobi(s){

    if(
        s.length < 2
    ){

        return false;
    }


    const separator =
        s[1];


    if(
        separator !== "." &&
        separator !== "/"
    ){

        return false;
    }


    for(
        let i=1;
        i<s.length;
        i+=2
    ){

        if(
            s[i] !== separator
        ){

            return false;
        }
    }


    return true;
}
