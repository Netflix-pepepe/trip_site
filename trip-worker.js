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

        makeTrip12(
            String(
                data.key == null
                    ? ""
                    : data.key
            )
        )
        .then(function (trip) {

            self.postMessage({
                type: "generated",
                key: String(
                    data.key == null
                        ? ""
                        : data.key
                ),
                trip: trip,
                length: 12
            });

        })
        .catch(function (e) {

            self.postMessage({
                type: "error",
                message:
                    e && e.stack
                        ? e.stack
                        : String(e)
            });
        });

        return;
    }


    /* -------------------------------------
       検証
    ------------------------------------- */

    if (data.type === "test") {

        testAll();

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
   テスト
========================================= */

async function testAll() {

    try {

        /*
         * 10桁では
         *
         * aaaaaaaaXX
         *
         * のXXは無視される。
         */

        const a =
            makeTrip10(
                "aaaaaaaaaa"
            );

        const b =
            makeTrip10(
                "aaaaaaaaZZ"
            );

        const c =
            makeTrip10(
                "aaaaaaaabc"
            );

        const d =
            makeTrip10(
                "aaaaaaaa11"
            );


        /*
         * 12桁
         */

        const t12 =
            await makeTrip12(
                "aaaaaaaaaaaa"
            );


        self.postMessage({

            type: "test-ok",

            result: {

                trip10_a:
                    a,

                trip10_b:
                    b,

                trip10_c:
                    c,

                trip10_d:
                    d,

                trip10_same:
                    (
                        a === b &&
                        b === c &&
                        c === d
                    ),

                trip12:
                    t12
            }
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
}


/* =========================================
   10桁トリップ
========================================= */

/*
 * 10桁トリップの仕様
 *
 * キー:
 *
 *   12345678AA
 *
 * 実際に使用:
 *
 *   12345678
 *
 * 9文字目・10文字目は無視。
 *
 * crypt結果の末尾10文字を
 * トリップとして使用。
 */

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
     * 10桁キーとして扱う。
     *
     * 8文字未満でも計算可能だが、
     * UIからの通常入力では10文字を推奨。
     */

    const usedKey =
        key.substring(0, 8);


    /*
     * salt生成用。
     *
     * 2ch方式:
     *
     * substr($tripkey.'H.', 1, 2)
     */

    let salt =
        (
            usedKey + "H."
        ).substring(1, 3);


    salt =
        normalizeSalt(
            salt
        );


    const result =
        crypt(
            usedKey,
            salt
        );


    if (
        typeof result !== "string"
    ) {

        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }


    /*
     * crypt() の末尾10文字
     */

    return result.slice(-10);
}


/* =========================================
   Salt
========================================= */

function normalizeSalt(salt) {

    let result = "";

    for (
        let i = 0;
        i < 2;
        i++
    ) {

        let c =
            salt.charAt(i);


        if (!c) {

            c = ".";
        }


        let code =
            c.charCodeAt(0);


        /*
         * [.-z] 以外は .
         */

        if (
            code < 0x2E ||
            code > 0x7A
        ) {

            c = ".";

        } else {

            /*
             * Perl:
             *
             * tr/:;<=>?@[\\]^_`/ABCDEFGabcdef/
             */

            switch (c) {

                case ":":
                    c = "A";
                    break;

                case ";":
                    c = "B";
                    break;

                case "<":
                    c = "C";
                    break;

                case "=":
                    c = "D";
                    break;

                case ">":
                    c = "E";
                    break;

                case "?":
                    c = "F";
                    break;

                case "@":
                    c = "G";
                    break;

                case "[":
                    c = "a";
                    break;

                case "\\":
                    c = "b";
                    break;

                case "]":
                    c = "c";
                    break;

                case "^":
                    c = "d";
                    break;

                case "_":
                    c = "e";
                    break;

                case "`":
                    c = "f";
                    break;
            }
        }


        result += c;
    }


    return result;
}


/* =========================================
   12桁トリップ
========================================= */

/*
 * 12桁はキー全体をSHA-1へ投入。
 *
 * SHA-1
 *   ↓
 * Base64
 *   ↓
 * 先頭12文字
 */

async function makeTrip12(key) {

    key =
        String(key);


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


    const base64 =
        btoa(binary);


    /*
     * 2ch系12桁
     *
     * + を . に変更
     */

    return base64
        .substring(0, 12)
        .replace(/\+/g, ".");
}


/* =========================================
   検索
========================================= */

async function search(data) {

    /*
     * 10:
     *
     * キー10文字
     * ↓
     * 先頭8文字だけ使用
     *
     *
     * 12:
     *
     * キー12文字
     * ↓
     * 全12文字使用
     */

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
     * 同じ文字の連続は
     * randomComplexKey() 側で禁止。
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
         * 10桁なら10文字。
         *
         * 12桁なら12文字。
         */

        const key =
            randomComplexKey(
                charset,
                length
            );


        let trip;


        try {

            if (length === 10) {

                trip =
                    makeTrip10(
                        key
                    );

            } else {

                trip =
                    await makeTrip12(
                        key
                    );
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
         * 条件一致
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
             * 必ず実際に使ったキーを返す。
             *
             * 10桁:
             * 末尾2文字も返すが
             * トリップ計算には無関係。
             *
             * 12桁:
             * 12文字すべてが計算対象。
             */

            self.postMessage({
                type: "hit",
                key: key,
                trip: trip,
                length: length
            });
        }


        /*
         * 2048回ごとに進捗
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
   ランダムキー生成
========================================= */

/*
 * ここが今回の重要部分。
 *
 * 以前:
 *
 *   T!!!!
 *   aaaa
 *   .....
 *
 * のようなキーが出る可能性があった。
 *
 *
 * 今回:
 *
 *   隣接する同一文字を禁止。
 *
 * 例:
 *
 *   !fa4K{0]
 *   T@3!v]x
 *   a#7K!p$2
 *   ]x4@F!9{
 *
 * OK
 *
 *
 *   T!!!!@]v
 *   aaaaaaaa
 *   ..../...
 *
 * NG
 */

function randomComplexKey(
    charset,
    length
) {

    const result = [];

    const size =
        charset.length;


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
         *
         * 文字ごとの偏りを抑える。
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
             * 隣と同じ文字は禁止
             */

            if (
                char === previous
            ) {

                continue;
            }


            result.push(
                char
            );


            previous =
                char;
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
