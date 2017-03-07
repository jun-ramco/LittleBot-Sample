/**
 * Created by Wang Jun on 1/2/2017.
 */
var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: "7c79960a-5a3d-42e0-8222-683d6d7a237e",
    appPassword: "9QmxnsrSdvPdZPXsCUuG8sy"
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================
var weather = require('weather-js');
var request = require("request");
var cheerio = require("cheerio");
var googleSearchUrl = "https://www.google.com/search?q=";

// Create LUIS recognizer that points at our model and add it as the root '/' dialog for our Cortana Bot.
var model = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/a03f376a-d5eb-45ac-9119-f0fba6043a5d?subscription-key=1ffc1c1e816a4def8d56317322754bcb&verbose=true';
var recognizer = new builder.LuisRecognizer(model);

var intents = new builder.IntentDialog({recognizers: [recognizer]});
bot.dialog('/', intents);

intents.onDefault([
    function (session, args, next) {
        if (!session.userData.name) {
            session.beginDialog('/profile');
        } else {
            next();
            //console.log( "after next...");
        }
    },
    function (session, results) {
        session.send('Hi %s! What can I do for you?', session.userData.name);
    }
]);

intents.matches(/^change name/i, [
    function (session) {
        session.beginDialog('/profile');
    },
    function (session, results) {
        session.send('Ok... Changed your name to %s', session.userData.name);
    }
]);

intents.matches('searchonline', [function (session, args, next) {
    var searchText = builder.EntityRecognizer.findEntity(args.entities, 'searchText');
    if (searchText) {
        session.dialogData.searchText = searchText.entity;
        googleSearchUrl = googleSearchUrl + searchText.entity;
    }
    session.send("Let me google it for you ");
    session.beginDialog('/searchOnline');
}]);


// Add intent handlers for apply leaves
intents.matches('applyleave', [
    function (session, args, next) {
        // Resolve and store any entities passed from LUIS.
        var fromDate = builder.EntityRecognizer.findEntity(args.entities, 'fromDate');
        var toDate = builder.EntityRecognizer.findEntity(args.entities, 'toDate');

        if (fromDate && toDate) {
            session.send("Sure. I will apply leave for you from '%s' to '%s' ", fromDate.entity, toDate.entity);
            //builder.Prompts.text(session, 'What date do you want apply leave from?');
        } else {
            next();
        }

    }
]);

intents.matches('getweather', [function (session, args, next) {
    var city = builder.EntityRecognizer.findEntity(args.entities, 'city');
    if (city) {
        city = city.entity;
        session.dialogData.city = city;
        next();
    } else {
        builder.Prompts.text(session, 'Which city do you want to know the weather about? ');
    }
}, function (session, results, next) {
    if (results.response)
        var city = results.response;
    if (!session.dialogData.city)
        session.dialogData.city = city;
    builder.Prompts.choice(session, 'For which day?', "yesterday|today|tommorrow");
},

    function (session, results, next) {
        var city = session.dialogData.city;
        weather.find({search: city, degreeType: 'C'}, function (err, result) {
            if (err) console.log(err);
            if (!result) {
                session.send('%s is not found. can you please input a valid city name and try again?', city);
            } else {
                switch (results.response.entity) {
                    case 'yesterday':
                        session.send("It is %s in %s yesterday. The temperature ranges from %s 'C to %s 'C.",
                            result[0].forecast[0].skytextday, result[0].location.name, result[0].forecast[0].low, result[0].forecast[0].high);
                        break;
                    case 'today' :
                        session.send("It is %s in %s today. The temperature currently is %s 'C.",
                            result[0].current.skytext, result[0].location.name, result[0].current.temperature);
                        break;
                    case 'tommorrow' :
                        session.send("It is %s in %s tomorrow. The temperature ranges from %s 'C to %s 'C.",
                            result[0].forecast[2].skytextday, result[0].location.name, result[0].forecast[2].low, result[0].forecast[1].high);
                        break;
                    default :
                        session.send("It is %s in %s now. The temperature currently is %s 'C.",
                            result[0].current.skytext, result[0].location.name, result[0].current.temperature);
                }
            }

        });

        //session.beginDialog('/weather');
    }]);

bot.dialog('/profile', [
    function (session) {
        session.send('Bello!Bello!Bello!');
        //builder.Prompts.text(session, 'Bello! Bello! Bello!');
        builder.Prompts.text(session, 'What is your name?');
    },
    function (session, results) {
        session.userData.name = results.response;
        session.send('Hi %s! Nice to meet you. ', session.userData.name);
        session.endDialog();
    }
]);

bot.dialog('/searchOnline', [function (session, args, next) {
    var reply;
    var urls = new Array();

    request(googleSearchUrl, function (error, response, body) {
        console.log("requesting ");
        if (error) {
            console.log("Couldn’t get page because of error: " + error);
            return;
        }

        console.log("no error. getting the links");
        // load the body of the page into Cheerio so we can traverse the DOM
        var $ = cheerio.load(body);
        var links = $(".r a");

        links.each(function (i, link) {
            // get the href attribute of each link
            var url = $(link).attr("href");

            // strip out unnecessary junk
            url = url.replace("/url?q=", "").split("&")[0];

            if (url.charAt(0) === "/") {
                return;
            }
            urls.push(url);
            console.log("url: " + url);
        });

        session.send("Here is what i found on google: %s ", urls[0]);
        session.endDialog();

    });

} ]);

