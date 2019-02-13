const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const axios = require('axios')

const stdin = process.openStdin();

/*
stdin.addListener("data", function(d) {
  // note:  d is an object, and when converted to a string it will
  // end with a linefeed.  so we (rather crudely) account for that  
  // with toString() and then trim() 
  console.log("you entered: [" + 
      d.toString().trim() + "]");
});
*/

// If modifying these scopes, delete token.json.
const SCOPES = [
  // 'https://www.googleapis.com/auth/calendar.readonly',
  // 'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar'
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
let access_token;

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), getActionFromUser, listEvents, deleteNextEvent);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    client_token = JSON.parse(token)
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function getCalendar(auth) {
  return google.calendar({ version: 'v3', auth })
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth, numberOfEvents = 10) {
  const calendar = getCalendar(auth)
  const isoDate = (new Date(2018, 5, 26)).toISOString()

  calendar.events.list(
    paramsEventsList(isoDate, numberOfEvents),
    (err, res) => {
      if (err) console.log(err)

      const { items } = res.data
      if (items.length) {
        res.data.items.map((event, i) => {
          const start = event.start.dateTime || event.start.date;
          console.log(`${start.slice(0, 10)} at ${start.slice(11, 16)} - ${event.summary} -> eventID: ${event.id}`);
        });
      } else {
        console.log('No events found')
      }
    }
  )
}

function paramsEventsList(fromIsoDate, numberOfEvents) {
  const paramsList = {
    calendarId: 'primary',
    timeMin: fromIsoDate,
    maxResults: numberOfEvents,
    singleEvents: true,
    orderBy: 'startTime'
  }
  return paramsList
}

function getActionFromUser(auth) {
  console.log('1 - List events')
  console.log('2 - Insert event')
  console.log('3 - Update event')
  console.log('4 - Delete event')
  console.log('5 - Revoke token')
  console.log('0 - Exit')
  console.log('\n')
  console.log('Choose an action:')

  stdin.addListener("data", function(d) {
    switch(Number(d)) {
      case 1:
        listEvents(auth)
        break
      case 2:
        createEvent(auth)
        break
      case 3:
        updateEvent(auth)
        break
      case 4:
        deleteNextEvent(auth)
        break
      case 5:
        revokeToken(auth)
        break
      case 0:
        process.exit()
        break
    }
  });
}

// function getListOfEvents(calendar, fromIsoDate, numberOfEvents) {
//   calendar.events.list(
//     paramsEventsList(fromIsoDate, numberOfEvents),
//     (err, res) => {
//       if (err) {
//         return err
//       }
//       return res
//     }
//   )
// }

function deleteNextEvent(auth) {
  const calendar = getCalendar(auth)
  const isoDate = (new Date(2018, 5, 26)).toISOString()

  calendar.events.list(
    paramsEventsList(isoDate, 1),
    (err, res) => {
      if (err) console.log(err)

      const { items } = res.data
      if (items.length) {
        res.data.items.map((event, i) => {
          const start = event.start.dateTime || event.start.date;
          console.log(`${start.slice(0, 10)} at ${start.slice(11, 16)} - ${event.summary}`);
        });

        // console.log(items[0].id)
        deleteEvent(auth, items[0].id)
      } else {
        console.log('No events found')
      }
    }
  )
}

function createEvent(auth) {
  const calendar = google.calendar({version: 'v3', auth})
  // console.log(calendar)

  let event = {
    'summary': 'Video Conferência',
    'description': '',
    'start': {
      'dateTime': '2019-01-14T21:30:00.192Z',
    },
    'end': {
      'dateTime': '2019-01-14T23:00:00.192Z',
    },
    'attendees': [
      {'email': 'lpage@example.com'},
      {'email': 'sbrin@example.com'},
    ],
    'reminders': {
      'useDefault': false,
      'overrides': [
        {'method': 'email', 'minutes': 24 * 60},
        {'method': 'popup', 'minutes': 30},
      ],
    },
  };

  calendar.events.insert({
    auth: auth,
    calendarId: 'primary',
    resource: event,
  }, (err, res) => {
    if (err) return console.log(err)
    const event = res.data

    if(event) {
      console.log('Booked event:')
      console.log(event)
    }
  })
}

function updateEvent(auth) {
  const calendar = google.calendar({version: 'v3', auth})

  const calendarId = 'primary'
  let eventId = ''

  let event = {};

  calendar.events.list(
    paramsEventsList((new Date(1970, 1, 1)).toISOString(), 10),
    (err, res) => {
      if (err) console.log(err)

      const { items } = res.data

      eventId = items[items.length -1].id

      event = items[items.length -1]
      event.start.dateTime = '2019-01-03T15:00:00.192Z',
      event.end.dateTime = '2019-01-03T23:00:00.192Z',
    
      calendar.events.update({
        auth,
        calendarId,
        eventId,
        resource: event,
      }, (err, res) => {
        if (err) return console.log(err)
        const event = res.data
    
        if(event) {
          console.log('Booked event:')
          console.log(event)
        }
      })
    }
  )

}

function deleteEvent(auth, evId) {
  const calendar = google.calendar({version: 'v3', auth})

  calendar.events.delete({
    auth: auth,
    calendarId: 'primary',
    eventId: evId
  }, (err, res) => {
    if (err) return console.log(err)
    if (res) {
      console.log('Event deleted!')
    }
  })
}

function revokeToken() {
  axios.post(`https://accounts.google.com/o/oauth2/revoke?token=${client_token.access_token}`, {
  }).then((res) => {
    console.log('status: ', res.response.status, 'response: ', res.response.statusText)
  }).catch((err) => {
    console.log('Access Token error: ', err.response.data)
  })

  axios.post(`https://accounts.google.com/o/oauth2/revoke?token=${client_token.refresh_token}`, {
  }).then((res) => {
    console.log('status: ', res.response.status, 'response: ', res.response.statusText)
  }).catch((err) => {
    console.log('Refresh Token error: ', err.response.data)
  })

}

function getFirstEventBySummary(auth, eventSummary) {

}

function getLastEventBySummary(auth, eventSummary) {

}

