#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sass = require("node-sass");
const Snoowrap = require("snoowrap");

// == COMPILE == //
const inputFile = path.resolve(process.cwd(), "style.scss");
const outputFile = path.resolve(process.cwd(), "dist/index.css");
const compileWatchCb = (function(){
    let compileTimeout;
    return function watchCb() {
        clearTimeout(compileTimeout);
        compileTimeout = setTimeout(compile, 100);
    };
})();
function compile() {
    console.log("Compiling SCSS");
    sass.render({
        file: inputFile,
    }, (err, result) => {
        if (err) {
            console.error("Error in SCSS:\n", err);
            return;
        }
        console.log("Compiled");
        fs.writeFileSync(outputFile, result.css);
        upload();
    });
}
const watchers = [
    fs.watch(path.resolve(process.cwd(), "styles"), compileWatchCb),
    fs.watch(inputFile, compileWatchCb)
];
process.on("exit", () => {
    console.log("Closing compile watchers");
    watchers.forEach(watcher => watcher.close());
});
console.log("Watching for compiles", inputFile, outputFile);

// == PUBLISH == //
/**
 * Gets the credentials stored in secrets.json.
 * Ends the process if secrets.json is not set up properly.
 */
const getSecrets = (function(){
    const requiredCredentials = ["username", "password", "clientId", "clientSecret"];
    return function getSecrets(filePath) {
        /** @type {{credentials: {username: string, password: string, clientId: string, clientSecret: string}, subreddit: string}} */
        let secrets = {};
        try {
            secrets = require(filePath);
            if (!secrets.credentials
                    || !secrets.subreddit
                    || !requiredCredentials.every(k => secrets.credentials[k])) {
                throw new Error("Secrets doesn't contain everything needed.");
            }
        } catch (e) {
            secrets.subreddit = secrets.subreddit || null;
            secrets.credentials = secrets.credentials || {};
            requiredCredentials.forEach(k => secrets.credentials[k] = secrets.credentials[k] || null);
            fs.writeFileSync(
                path.resolve(filePath),
                JSON.stringify(secrets, null, 2)
            );
            console.log(`Didn't find information needed. Please fill out secrets.json.
You need to create a Reddit API app for this:
    https://www.reddit.com/prefs/apps/
A quick guide is available at:
    https://www.npmjs.com/package/restyle-reddit#restyle-config`);
            process.exit(1);
        }
        return secrets;
    };
})();
const secrets = getSecrets(path.resolve(process.cwd(), "secrets.json"));
const snoo = new Snoowrap({
    username: secrets.credentials.username,
    password: secrets.credentials.password,
    clientId: secrets.credentials.clientId,
    clientSecret: secrets.credentials.clientSecret,
    userAgent: `EU4 style uploader`
});
const subreddit = snoo.getSubreddit(secrets.subreddit);
function upload() {
    console.log("Uploading "+outputFile);
    const content = fs.readFileSync(outputFile);
    subreddit.updateStylesheet({
        css: content,
        reason: 'Automatic upload'
    })
        .then(() => console.log("Finished uploading"))
        .catch(e => console.log("Failed upload -", e));
}