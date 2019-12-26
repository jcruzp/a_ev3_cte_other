#include <Wire.h>
#include <Adafruit_GPS.h>
#include <SoftwareSerial.h>
#include "SparkFunHTU21D.h"

#define ARDUINO_ADDRESS 0x70

// Software serial TX & RX Pins for the gpsSerial module
#define SoftrxPin 3
#define SofttxPin 2

// Initiate the software serial connection
SoftwareSerial mySerial(SoftrxPin, SofttxPin);
Adafruit_GPS gpsSerial(&mySerial);

// HTU21D class to read humidity
HTU21D myHumidity;

int ledPin = 6; //LED test pin
int ledPin2 = 5; //LED test pin

//#define DEBUG_GPSSERIAL
//#define DEBUG_HUMIDITY
//#define DEBUG_I2C

//variable that checks if there was already data from the gpsSerial module
boolean dataAvailable = false;

// gpsSerial variables
int bytegps = -1; //byte containing current received byte

//char gps0[7] = ""; //time in UTC (HhMmSs)
//char gps1 = ' '; //status of the data (A=active, V=invalid)
char latitude[12] = ""; //latitude
char lon = ' '; //latitude Hemisphere (N/S)
char longitude[12] = ""; //longitude
char lat = ' '; //longitude Hemisphere (E/W)
//char gps6[4] = ""; //velocity (knots)
char humidity[8] = ""; //humidity
//char gps8[4] = ""; //checksum

byte i2cCmd = -1;

#define CMD_INVALID -1
#define CMD_ERROR 253
#define GPS_NO_DATA 254

//All supported commands to I2C comunication EV3 - Arduino Pro
#define CMD_GET_LATITUDE     0x02
#define CMD_GET_LAT          0x03
#define CMD_GET_LONGITUDE    0x04
#define CMD_GET_LON          0x05
#define CMD_GET_HUMIDITY     0x07


void setup()
{

  Serial.begin(115000); //start serial for output
  Serial.println("Arduino init...");
  myHumidity.begin();
  readHumidity();

  pinMode(ledPin, OUTPUT); //initialize LED pins
  pinMode(ledPin2, OUTPUT);
  blinkBothLED(); // blink leds to indicate the program has booted

  gpsSerial.begin(9600); //start serial for communication with gpsSerial


  // uncomment this line to turn on RMC (recommended minimum) and GGA (fix data) including altitude
  gpsSerial.sendCommand(PMTK_SET_NMEA_OUTPUT_RMCGGA);
  // uncomment this line to turn on only the "minimum recommended" data
  //gpsSerial.sendCommand(PMTK_SET_NMEA_OUTPUT_RMCONLY);
  // For parsing data, we don't suggest using anything but either RMC only or RMC+GGA since
  // the parser doesn't care about other sentences at this time

  // Set the update rate
  gpsSerial.sendCommand(PMTK_SET_NMEA_UPDATE_1HZ);   // 1 Hz update rate
  // For the parsing code to work nicely and have time to sort thru the data, and
  // print it out we don't suggest using anything higher than 1 Hz

  Wire.begin(ARDUINO_ADDRESS); //join i2c bus with address 112
  Wire.onRequest(requestEvent); //request event
  Wire.onReceive(receiveEvent);

  delay(1000);

  mySerial.println(PMTK_Q_RELEASE);

  Serial.println("Arduino init Ok at address " + (String) ARDUINO_ADDRESS );
}

void loop()
{
  //delay(100);
  //poll the gpsSerial module
  readGPS();
}

void receiveEvent(int howMany)
{
  byte i2cCmdWrite;

  i2cCmdWrite = -1;
  //Process all received commands
  while (Wire.available()) {
    i2cCmdWrite = Wire.read();   // receive first byte - command assumed
#ifdef DEBUG_I2C
    Serial.print(F("\r\nCommand received: "));
    Serial.print(i2cCmdWrite);
#endif
  }
  if (i2cCmdWrite != 0) i2cCmd = i2cCmdWrite;
}

void requestEvent()
{
  digitalWrite(ledPin2, HIGH); //make the LED pin high to show a transaction starts
  if (i2cCmd == CMD_GET_HUMIDITY)
    Wire.write(humidity, 8);
  else if (dataAvailable)
    switch (i2cCmd) {
      case CMD_INVALID:
        Wire.write(CMD_ERROR);
        break;
      case CMD_GET_LATITUDE:
        Wire.write(latitude, 12);
        break;
      case CMD_GET_LAT:
        Wire.write(lat);
        break;
      case CMD_GET_LONGITUDE:
        Wire.write(longitude, 12);
        break;
      case CMD_GET_LON:
        Wire.write(lon);
        break;
    }
  else {
    Wire.write(GPS_NO_DATA);
  }
  digitalWrite(ledPin2, LOW); //make the LED pin high to show a transaction starts
}

void readHumidity() {
  float humd = 0.0;
  do {
    humd = myHumidity.readHumidity();
  } while (humd == ERROR_I2C_TIMEOUT || humd == ERROR_BAD_CRC);
  dtostrf(humd, 7, 2, humidity);
#ifdef DEBUG_HUMIDITY
  Serial.print("Humidity=");
  Serial.println(humidity);
#endif
}

uint32_t timer = millis();

void readGPS() {

  //function to receive gpsSerial data from the module
  digitalWrite(ledPin, LOW); //start by making the LED low
  bytegps = gpsSerial.read(); //read a byte from the serial port
  if (bytegps == -1) { //if no data is received, then do nothing
    delay(100);
  }
  else {

    // if a sentence is received, we can check the checksum, parse it...
    if (gpsSerial.newNMEAreceived()) {
      // a tricky thing here is if we print the NMEA sentence, or data
      // we end up not listening and catching other sentences!
      // so be very wary if using OUTPUT_ALLDATA and trytng to print out data
      //Serial.println(gpsSerial.lastNMEA());   // this also sets the newNMEAreceived() flag to false

      if (!gpsSerial.parse(gpsSerial.lastNMEA())) {  // this also sets the newNMEAreceived() flag to false
        dataAvailable = false;
        return;  // we can fail to parse a sentence in which case we should just wait for another
      }
    }


    // if millis() or timer wraps around, we'll just reset it
    if (timer > millis())  timer = millis();

    // approximately every 2 seconds or so, print out the current stats
    if (millis() - timer > 2000) {
      digitalWrite(ledPin, HIGH); //enable the LED pin
      timer = millis(); // reset the timer
#ifdef DEBUG_GPSSERIAL
      Serial.print("\nTime: ");
      if (gpsSerial.hour < 10) {
        Serial.print('0');
      }
      Serial.print(gpsSerial.hour, DEC); Serial.print(':');
      if (gpsSerial.minute < 10) {
        Serial.print('0');
      }
      Serial.print(gpsSerial.minute, DEC); Serial.print(':');
      if (gpsSerial.seconds < 10) {
        Serial.print('0');
      }
      Serial.print(gpsSerial.seconds, DEC); Serial.print('.');
      if (gpsSerial.milliseconds < 10) {
        Serial.print("00");
      } else if (gpsSerial.milliseconds > 9 && gpsSerial.milliseconds < 100) {
        Serial.print("0");
      }
      Serial.println(gpsSerial.milliseconds);

      Serial.print("Date: ");
      Serial.print(gpsSerial.day, DEC); Serial.print('/');
      Serial.print(gpsSerial.month, DEC); Serial.print("/20");
      Serial.println(gpsSerial.year, DEC);
      Serial.print("Fix: "); Serial.print((int)gpsSerial.fix);
      Serial.print(" quality: "); Serial.println((int)gpsSerial.fixquality);
#endif

      if (gpsSerial.fix) {
#ifdef DEBUG_GPSSERIAL
        Serial.print("Location: ");
        Serial.print(gpsSerial.latitude, 4); Serial.print(gpsSerial.lat);
#endif
        //convertString(gpsSerial.latitude, latitude);
        dtostrf(gpsSerial.latitude, 11, 4, latitude);
        lat = gpsSerial.lat;
#ifdef DEBUG_GPSSERIAL
        Serial.print(", ");
        Serial.print(gpsSerial.longitude, 4); Serial.println(gpsSerial.lon);
#endif
        //convertString(gpsSerial.longitude, longitude);
        dtostrf(gpsSerial.longitude, 11, 4, longitude);
        lon = gpsSerial.lon;
#ifdef DEBUG_GPSSERIAL
        Serial.print("Latitud=");
        Serial.println(latitude);
        Serial.print("Longitude=");
        Serial.println(longitude);
#endif
#ifdef DEBUG_GPSSERIAL
        Serial.print("Speed (knots): "); Serial.println(gpsSerial.speed);
        Serial.print("Altitude: "); Serial.println(gpsSerial.altitude);
        Serial.print("Satellites: "); Serial.println((int)gpsSerial.satellites);
#endif
        dataAvailable = true;
      }
      else
        dataAvailable = false;
    }
  }
}

void blinkBothLED()
{
  //function to blink both LEDs
  digitalWrite(ledPin, HIGH);
  digitalWrite(ledPin2, HIGH);
  delay(500);
  digitalWrite(ledPin, LOW);
  digitalWrite(ledPin2, LOW);
  delay(500);
}
