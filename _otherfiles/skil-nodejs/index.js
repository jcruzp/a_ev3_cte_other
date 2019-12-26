/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates.  All Rights Reserved.
 *
 * You may not use this file except in compliance with the terms and conditions 
 * set forth in the accompanying LICENSE.TXT file.
 *
 * THESE MATERIALS ARE PROVIDED ON AN "AS IS" BASIS. AMAZON SPECIFICALLY DISCLAIMS, WITH 
 * RESPECT TO THESE MATERIALS, ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING 
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
*/

// This skill sample demonstrates how to send directives and receive events from an Echo connected gadget.
// This skill uses the Alexa Skills Kit SDK (v2). Please visit https://alexa.design/cookbook for additional
// examples on implementing slots, dialog management, session persistence, api calls, and more.

const Alexa = require('ask-sdk-core');
const Util = require('./util');
const Common = require('./common');

// The audio tag to include background music
const BG_MUSIC = '<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_waiting_loop_30s_01"/>';

// The namespace of the custom directive to be sent by this skill
const NAMESPACE = 'Custom.Mindstorms.Gadget';

// The name of the custom directive to be sent this skill
const NAME_CONTROL = 'control';

const BOTATBASE = 'base';
const BOTREDTOWER = 'red tower';
const BOTBLUETOWER = 'blue tower'

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle: async function (handlerInput) {

        const request = handlerInput.requestEnvelope;
        const { apiEndpoint, apiAccessToken } = request.context.System;
        const apiResponse = await Util.getConnectedEndpoints(apiEndpoint, apiAccessToken);
        if ((apiResponse.endpoints || []).length === 0) {
            return handlerInput.responseBuilder
                .speak(`I couldn't find an EV3 Brick connected to this Echo device. Please check to make sure your EV3 Brick is connected, and try again.`)
                .getResponse();
        }


        // Set bot start position at base
        Util.putSessionAttribute(handlerInput, 'botPosition', BOTATBASE);

        // Store the gadget endpointId to be used in this skill session
        const endpointId = apiResponse.endpoints[0].endpointId || [];
        Util.putSessionAttribute(handlerInput, 'endpointId', endpointId);

        // Set skill duration to 5 minutes (ten 30-seconds interval)
        Util.putSessionAttribute(handlerInput, 'duration', 10);

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Util.putSessionAttribute(handlerInput, 'token', token);

        let speechOutput = "Autonomous EV3 Color Station Finder Bot is reading for explore stations at field";
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(Util.buildStartEventHandler(token, 60000, {}))
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the ExploreIntent.
const ExploreIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ExploreIntent';
    },
    handle: function (handlerInput) {

        let towerColorA = Alexa.getSlotValue(handlerInput.requestEnvelope, 'TowerColorA');
        let towerColorB = Alexa.getSlotValue(handlerInput.requestEnvelope, 'TowerColorB');

        if (towerColorA === towerColorB) {
            return handlerInput.responseBuilder
                .speak(`The first and second tower must have different colors`)
                .withShouldEndSession(false)
                .getResponse();
        }


        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];

        let speechOutput = ''
        let directive = ''
        if (towerColorB === undefined) {
            // Construct the directive with the payload containing the move parameters
            directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                {
                    type: 'exploring_towers',
                    towerColorA: towerColorA
                });

            // Only use for test propouse
            Util.putSessionAttribute(handlerInput, 'botPosition', (towerColorA === 'red' ? BOTREDTOWER : BOTBLUETOWER));

            speechOutput = `Going to explore tower ${towerColorA}`;
        } else {
            // Construct the directive with the payload containing the move parameters
            directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                {
                    type: 'exploring_towers',
                    towerColorA: towerColorA,
                    towerColorB: towerColorB
                });
            speechOutput = `Going to explore tower ${towerColorA} and ${towerColorB}`;
        }

        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};


// Construct and send a custom directive to the connected gadget with data from
// the ConditionsIntent.
const ConditionsIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConditionsIntent';
    },
    handle: function (handlerInput) {

        let condition = Alexa.getSlotValue(handlerInput.requestEnvelope, 'ReadConditions');

        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        const botposition = attributesManager.getSessionAttributes().botPosition || BOTATBASE;

        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'read_conditions',
                botposition: botposition,
                condition: condition
            });

        let speechOutput = `Reading ${condition} at ${botposition}`;

        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the ReturnBaseIntent.
const ReturnBaseIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ReturnBaseIntent';
    },
    handle: function (handlerInput) {

        const attributesManager = handlerInput.attributesManager;
        const botposition = attributesManager.getSessionAttributes().botPosition || BOTATBASE;

        if (botposition === BOTATBASE) {
            return handlerInput.responseBuilder
                .speak(`The bot is already at base position`)
                .withShouldEndSession(false)
                .getResponse();
        }


        let endpointId = attributesManager.getSessionAttributes().endpointId || [];

        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'return_base'
            });


        let speechOutput = `Returning base from ${botposition}`;

        // Only use for test propouse
        Util.putSessionAttribute(handlerInput, 'botPosition', BOTATBASE);

        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the VerifyColorIntent.
const VerifyColorIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'VerifyColorIntent';
    },
    handle: function (handlerInput) {

        const attributesManager = handlerInput.attributesManager;
        const botposition = attributesManager.getSessionAttributes().botPosition || BOTATBASE;

        if (botposition === BOTATBASE) {
            return handlerInput.responseBuilder
                .speak(`The bot is at base position cannot check color`)
                .withShouldEndSession(false)
                .getResponse();
        }


        let endpointId = attributesManager.getSessionAttributes().endpointId || [];

        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'verify_color',
                botposition: botposition
            });

        let speechOutput = `Verifying that bot is at ${botposition}`;

        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};


/*
// Add the speed value to the session attribute.
// This allows other intent handler to use the specified speed value
// without asking the user for input.
const SetSpeedIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetSpeedIntent';
    },
    handle: function (handlerInput) {

        // Bound speed to (1-100)
        let speed = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Speed');
        speed = Math.max(1, Math.min(100, parseInt(speed)));
        Util.putSessionAttribute(handlerInput, 'speed', speed);

        let speechOutput = `speed set to ${speed} percent.`;
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .getResponse();
    }
};



// Construct and send a custom directive to the connected gadget with
// data from the MoveIntent.
const MoveIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'MoveIntent';
    },
    handle: function (handlerInput) {
        const request = handlerInput.requestEnvelope;
        const direction = Alexa.getSlotValue(request, 'Direction');

        // Duration is optional, use default if not available
        const duration = Alexa.getSlotValue(request, 'Duration') || "2";

        // Get data from session attribute
        const attributesManager = handlerInput.attributesManager;
        const speed = attributesManager.getSessionAttributes().speed || "50";
        const endpointId = attributesManager.getSessionAttributes().endpointId || [];

        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'move',
                direction: direction,
                duration: duration,
                speed: speed
            });

        const speechOutput = (direction === "brake")
            ?  "Applying brake"
            : `${direction} ${duration} seconds at ${speed} percent speed`;

        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the SetCommandIntent.
const SetCommandIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetCommandIntent';
    },
    handle: function (handlerInput) {

        let command = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Command');
        if (!command) {
            return handlerInput.responseBuilder
                .speak("Can you repeat that?")
                .withShouldEndSession(false)
                .getResponse();
        }

        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        let speed = attributesManager.getSessionAttributes().speed || "50";

        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'command',
                command: command,
                speed: speed
            });

        let speechOutput = `command ${command} activated`;
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};
*/


const EventsReceivedRequestHandler = {
    // Checks for a valid token and endpoint.
    canHandle(handlerInput) {
        let { request } = handlerInput.requestEnvelope;
        console.log('Request type: ' + Alexa.getRequestType(handlerInput.requestEnvelope));
        if (request.type !== 'CustomInterfaceController.EventsReceived') return false;

        const attributesManager = handlerInput.attributesManager;
        let sessionAttributes = attributesManager.getSessionAttributes();
        let customEvent = request.events[0];

        // Validate event token
        if (sessionAttributes.token !== request.token) {
            console.log("Event token doesn't match. Ignoring this event");
            return false;
        }

        // Validate endpoint
        let requestEndpoint = customEvent.endpoint.endpointId;
        if (requestEndpoint !== sessionAttributes.endpointId) {
            console.log("Event endpoint id doesn't match. Ignoring this event");
            return false;
        }
        return true;
    },
    handle(handlerInput) {

        console.log("== Received Custom Event ==");
        let customEvent = handlerInput.requestEnvelope.request.events[0];
        let payload = customEvent.payload;
        let name = customEvent.header.name;

        let speechOutput;

        if (name === 'at_tower') {
            speechOutput = payload.speechOut;
        } else if (name === 'at_base') {
            speechOutput = payload.speechOut;
        } else if (name === 'temperature') {
            speechOutput = payload.speechOut;
        } else if (name === 'humidity') {
            speechOutput = payload.speechOut;
        } else if (name === 'color') {
            speechOutput = payload.speechOut;
        } else if (name === 'gps') {
            speechOutput = payload.speechOut;
        }
        // if (name === 'Proximity') {
        //     let distance = parseInt(payload.distance);
        //     if (distance < 10) {
        //         let speechOutput = "Intruder detected! What would you like to do?";
        //         return handlerInput.responseBuilder
        //             .speak(speechOutput, "REPLACE_ALL")
        //             .withShouldEndSession(false)
        //             .getResponse();
        //     }
        // } else if (name === 'Sentry') {
        //     if ('fire' in payload) {
        //         speechOutput = "Threat eliminated";
        //     }

        // } else if (name === 'Speech') {
        //     speechOutput = payload.speechOut;

        else {
            speechOutput = "Event not recognized. Awaiting new command.";
        }
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC, "REPLACE_ALL")
            .getResponse();
    }
};


const ExpiredRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'CustomInterfaceController.Expired'
    },
    handle(handlerInput) {
        console.log("== Custom Event Expiration Input ==");

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Util.putSessionAttribute(handlerInput, 'token', token);

        const attributesManager = handlerInput.attributesManager;
        let duration = attributesManager.getSessionAttributes().duration || 0;
        if (duration > 0) {
            Util.putSessionAttribute(handlerInput, 'duration', --duration);

            // Extends skill session
            const speechOutput = `${duration} minutes remaining.`;
            return handlerInput.responseBuilder
                .addDirective(Util.buildStartEventHandler(token, 60000, {}))
                .speak(speechOutput + BG_MUSIC)
                .getResponse();
        }
        else {
            // End skill session
            return handlerInput.responseBuilder
                .speak("Skill duration expired. Goodbye.")
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ExploreIntentHandler,
        ReturnBaseIntentHandler,
        VerifyColorIntentHandler,
        ConditionsIntentHandler,
        EventsReceivedRequestHandler,
        ExpiredRequestHandler,
        Common.HelpIntentHandler,
        Common.CancelAndStopIntentHandler,
        Common.SessionEndedRequestHandler,
        Common.IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addRequestInterceptors(Common.RequestInterceptor)
    .addErrorHandlers(
        Common.ErrorHandler,
    )
    .lambda();
