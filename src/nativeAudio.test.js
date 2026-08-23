import { readFileSync } from 'node:fs';
import path from 'node:path';

const plist = readFileSync(path.join(__dirname, '..', 'ios', 'App', 'App', 'Info.plist'), 'utf8');
const appDelegate = readFileSync(path.join(__dirname, '..', 'ios', 'App', 'App', 'AppDelegate.swift'), 'utf8');

describe('audio keeps playing when the iPad is locked', () => {
  test('the app declares the audio background mode', () => {
    // Without this iOS suspends the app on lock and the show stops, whatever
    // the audio session is set to.
    expect(plist).toMatch(/<key>UIBackgroundModes<\/key>/);
    const modes = plist.split('<key>UIBackgroundModes</key>')[1].split('</array>')[0];
    expect(modes).toMatch(/<string>audio<\/string>/);
  });

  test('the session is playback and is activated at launch', () => {
    expect(appDelegate).toMatch(/setCategory\(\.playback/);
    expect(appDelegate).toMatch(/setActive\(true\)/);
    expect(appDelegate).toMatch(/activateAudioSession\(\)/);
  });

  test('an interruption or a media services reset brings the session back', () => {
    expect(appDelegate).toMatch(/interruptionNotification/);
    expect(appDelegate).toMatch(/mediaServicesWereResetNotification/);
    expect(appDelegate).toMatch(/dreamliveAudioSessionRestored/);
  });

  test('going to the background tears nothing down', () => {
    const body = appDelegate
      .split('func applicationDidEnterBackground')[1]
      .split('func ')[0];
    expect(body).not.toMatch(/pause|setActive\(false\)|invalidate/i);
  });
});
