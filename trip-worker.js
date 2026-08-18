"use strict";

let crypt = null;
let running = false;

/* =========================================
   初期化
========================================= */

try {

    importScripts("./unix-crypt-td.min.js");

    if (typeof self.unixCryptTD === "function") {

        crypt = self.unixCryptTD;

    } else if (typeof self.z === "function") {

        crypt = self.z;

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

self.onmessage = function (event) {

    const data =
        event.data || {};

    /* -------------------------------------
       停止
    ------------------------------------- */

    if (data.type === "stop") {

        running = false;

        return;
    }


    /* -------------------------------------
       テスト
    ------------------------------------- */

    if (data.type === "test") {

        try {

            const tests = [
                "foob",
                "Jim",
                "aaaaaaaa",
                "aaaaaaaaaa",
                "test"
            ];

            const result = [];

            for (
                const key of tests
            ) {

                result.push({
                    key: key,
                    trip10: makeTrip10(key),
                    trip12: makeTrip12(key)
                });
            }

            self.postMessage({
                type: "test-ok",
                result: result
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

        return;
    }


    /* -------------------------------------
       10桁生成
    ------------------------------------- */

    if (data.type === "generate10") {

        try {

            const key =
                String(
                    data.key == null
                        ? ""
                        : data.key
                );

            const trip =
                makeTrip10(key);

            self.postMessage({
                type: "generated",
                key: key,
                trip: trip,
                length: 10
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

        return;
    }


    /* -------------------------------------
       12桁生成
    ------------------------------------- */

    if (data.type === "generate12") {

        try {

            const key =
                String(
                    data.key == null
                        ? ""
                        : data.key
                );

            const trip =
                makeTrip12(key);

            self.postMessage({
                type: "generated",
                key: key,
                trip: trip,
                length: 12
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

        return;
    }


    /* -------------------------------------
       検索
    ------------------------------------- */

    if (data.type === "search") {

        if (
            typeof crypt !== "function"
        ) {

            self.postMessage({
                type: "error",
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
   文字コード
========================================= */

/*
 * 12桁側はWeb CryptoのSHA-1を使用する。
 *
 * 日本語等を厳密な2ch互換にする場合は
 * Shift-JIS変換が必要になるため、
 * このWorkerではまずUTF-8を使用する。
 *
 * ASCIIの複雑キーについては問題ない。
 */


/* =========================================
   10桁トリップ
========================================= */

function makeTrip10(key) {

    if (
        typeof crypt !== "function"
    ) {

        throw new Error(
            "unixCryptTD unavailable"
        );
    }

    key =
        String(key);


    /*
     * 10桁トリップは
     *
     * crypt結果の末尾10文字
     *
     * を使用する。
     *
     * 重要：
     *
     * substring(2, 12)
     *
     * ではない。
     */


    /*
     * 2ch系10桁トリップでは
     * saltは key + "H." の
     * 2文字目・3文字目から作る。
     */

    const keyForSalt =
        key + "H.";

    let salt1 =
        keyForSalt.charAt(1);

    let salt2 =
        keyForSalt.charAt(2);


    salt1 =
        normalizeSalt(salt1);

    salt2 =
        normalizeSalt(salt2);


    const salt =
        salt1 + salt2;


    /*
     * unix crypt
     */

    const result =
        crypt(key, salt);


    if (
        typeof result !== "string"
    ) {

        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }


    /*
     * crypt() は通常13文字。
     *
     * 10桁トリップは末尾10文字。
     */

    return result.slice(-10);
}


/* =========================================
   Salt変換
========================================= */

function normalizeSalt(c) {

    if (!c) {
        return ".";
    }

    let code =
        c.charCodeAt(0);


    /*
     * 2chのsalt変換
     */

    if (
        code >= 0x3A &&
        code <= 0x40
    ) {

        code += 7;
    }


    if (
        code >= 0x5B &&
        code <= 0x60
    ) {

        code += 6;
    }


    /*
     * . ～ z 以外は .
     */

    if (
        code < 0x2E ||
        code > 0x7A
    ) {

        code = 0x2E;
    }


    return String.fromCharCode(
        code
    );
}


/* =========================================
   12桁トリップ
========================================= */

async function makeTrip12(key) {

    key =
        String(key);


    if (!key.length) {

        key = "\0";
    }


    const encoder =
        new TextEncoder();


    const bytes =
        encoder.encode(key);


    const hash =
        await crypto.subtle.digest(
            "SHA-1",
            bytes
        );


    const array =
        new Uint8Array(hash);


    let binary = "";


    for (
        let i = 0;
        i < array.length;
        i++
    ) {

        binary +=
            String.fromCharCode(
                array[i]
            );
    }


    /*
     * Base64
     */

    let base64 =
        btoa(binary);


    /*
     * 先頭12文字
     *
     * + → .
     */

    return base64
        .substring(0, 12)
        .replace(/\+/g, ".");
}


/* =========================================
   検索
========================================= */

function search(data) {

    const length =
        Number(data.length) === 12
            ? 12
            : 10;


    const conditions =
        Array.isArray(
            data.conditions
        )
            ? data.conditions
            : [];


    const special =
        data.special ||
        "none";


    /*
     * 複雑キー用文字セット
     *
     * . / はもちろん
     * ! @ # $ % ^ & * なども使用
     */

    const charset =
        data.charset ||
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789" +
        "./" +
        "!@#$%^&*()_+-=[]{}";


    let count = 0;


    while (running) {

        /*
         * 10桁と12桁で
         * 実際に使うキー長を変える。
         *
         * 10桁：
         * 最初の8文字が実質的なキー。
         *
         * 12桁：
         * 12文字以上。
         */

        let key;


        if (length === 10) {

            key =
                randomComplexKey(
                    charset,
                    8
                );

        } else {

            key =
                randomComplexKey(
                    charset,
                    12
                );
        }


        let trip;


        try {

            if (length === 10) {

                trip =
                    makeTrip10(key);

            } else {

                trip =
                    await makeTrip12(key);
            }

        } catch (e) {

            self.postMessage({
                type: "error",
                message:
                    e && e.message
                        ? e.message
                        : String(e)
            });

            running = false;

            return;
        }


        count++;


        /*
         * 条件判定
         */

        if (
            matchesConditions(
                trip,
                conditions
            ) &&
            matchesSpecial(
                trip,
                special
            )
        ) {

            /*
             * ここで返すkeyは
             * 実際にtrip生成に使用した
             * keyそのもの。
             *
             * 生成欄へコピーしても
             * 同じtripになる。
             */

            self.postMessage({
                type: "hit",
                key: key,
                trip: trip,
                length: length
            });
        }


        /*
         * 2048回ごと
         */

        if (
            (count & 2047) === 0
        ) {

            self.postMessage({
                type: "progress",
                count: 2048
            });
        }
    }


    self.postMessage({
        type: "stopped"
    });
}


/* =========================================
   複雑キー生成
========================================= */

function randomComplexKey(
    charset,
    length
) {

    const result = [];

    const size =
        charset.length;


    /*
     * 同じ文字が連続しないようにする。
     *
     * 例：
     *
     * NG
     * T!!!!
     * aaaa
     * .....
     *
     * OK
     * !fa4K{0
     * T@3!v]x
     */


    let previous =
        null;


    while (
        result.length < length
    ) {

        const buffer =
            new Uint8Array(64);


        crypto.getRandomValues(
            buffer
        );


        /*
         * rejection sampling
         */

        const max =
            256 -
            (
                256 %
                size
            );


        for (
            let i = 0;
            i < buffer.length &&
            result.length < length;
            i++
        ) {

            const value =
                buffer[i];


            if (
                value >= max
            ) {

                continue;
            }


            const char =
                charset[
                    value % size
                ];


            /*
             * 同一文字連続禁止
             */

            if (
                char === previous
            ) {

                continue;
            }


            result.push(char);

            previous =
                char;
        }
    }


    return result.join("");
}


/* =========================================
   条件判定
========================================= */

function matchesConditions(
    trip,
    conditions
) {

    for (
        const condition
        of conditions
    ) {

        if (!condition) {
            continue;
        }


        const text =
            String(
                condition.text ||
                ""
            );


        if (!text) {
            continue;
        }


        /*
         * 正規表現
         */

        if (condition.regex) {

            try {

                const re =
                    new RegExp(text);

                if (
                    !re.test(trip)
                ) {

                    return false;
                }

            } catch (e) {

                return false;
            }

            continue;
        }


        const mode =
            condition.mode ||
            "contains";


        if (
            mode === "contains" &&
            !trip.includes(text)
        ) {

            return false;
        }


        if (
            mode === "starts" &&
            !trip.startsWith(text)
        ) {

            return false;
        }


        if (
            mode === "ends" &&
            !trip.endsWith(text)
        ) {

            return false;
        }


        if (
            mode === "exact" &&
            trip !== text
        ) {

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
) {

    switch (type) {

        case "none":
        case "":
            return true;


        case "pure":
            return pureN(s);


        case "quasi":
            return quasiN(s);


        case "two":
            return twoKind(s);


        case "longest":
            return /^[MmW]+$/.test(s);


        case "shortest":
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


        case "numbers":
            return numbers(s);


        case "tobiishi":
            return tobiishi(s);


        case "kakutobi":
            return kakutobi(s);


        default:
            return true;
    }
}


/* =========================================
   純n連
========================================= */

function pureN(s) {

    let count = 1;


    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i] ===
            s[i - 1]
        ) {

            count++;


            if (
                count >= 8
            ) {

                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================
   準n連
========================================= */

function quasiN(s) {

    let count = 1;


    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i].toLowerCase() ===
            s[i - 1].toLowerCase()
        ) {

            count++;


            if (
                count >= 9
            ) {

                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================
   二構
========================================= */

function twoKind(s) {

    return (
        new Set(s).size <= 2
    );
}


/* =========================================
   八雲
========================================= */

function yakumo(s) {

    if (
        s.length < 6
    ) {

        return false;
    }


    const groups =
        Math.floor(
            s.length / 3
        );


    if (
        groups < 2
    ) {

        return false;
    }


    for (
        let i = 0;
        i < groups * 3;
        i += 3
    ) {

        if (
            s[i] !==
                s[i + 1] ||
            s[i] !==
                s[i + 2]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   鏡
========================================= */

function mirror(s) {

    const pair = {

        ".": ".",
        "0": "0",
        "8": "8",

        "A": "A",
        "H": "H",
        "I": "I",
        "M": "M",
        "O": "O",
        "T": "T",
        "U": "U",
        "V": "V",
        "W": "W",
        "X": "X",
        "Y": "Y",

        "b": "d",
        "d": "b",

        "i": "i",
        "l": "l",
        "o": "o",

        "p": "q",
        "q": "p",

        "v": "v",
        "w": "w"
    };


    for (
        let i = 0;
        i < s.length;
        i++
    ) {

        const left =
            s[i];


        const right =
            s[
                s.length -
                1 -
                i
            ];


        if (
            pair[left] !==
            right
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   回文
========================================= */

function palindrome(s) {

    for (
        let i = 0;
        i <
        Math.floor(
            s.length / 2
        );
        i++
    ) {

        if (
            s[i] !==
            s[
                s.length -
                1 -
                i
            ]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   山彦
========================================= */

function echo(s) {

    if (
        s.length % 2 !== 0
    ) {

        return false;
    }


    const half =
        s.length / 2;


    return (
        s.substring(
            0,
            half
        ) ===
        s.substring(
            half
        )
    );
}


/* =========================================
   双連
========================================= */

function doublePair(s) {

    if (
        s.length % 2 !== 0
    ) {

        return false;
    }


    for (
        let i = 0;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !==
            s[i + 1]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   全数
========================================= */

function numbers(s) {

    return /^[0-9]+$/.test(s);
}


/* =========================================
   飛石
========================================= */

function tobiishi(s) {

    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !== "." &&
            s[i] !== "/"
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   拡飛
========================================= */

function kakutobi(s) {

    if (
        s.length < 2
    ) {

        return false;
    }


    const separator =
        s[1];


    if (
        separator !== "." &&
        separator !== "/"
    ) {

        return false;
    }


    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !==
            separator
        ) {

            return false;
        }
    }


    return true;
}
