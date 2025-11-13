import React, { useState, useEffect, useRef } from 'react';
import AudioChannel from './components/AudioChannel';
import { Pause, FolderOpen, RefreshCw } from 'lucide-react';
import './App.css';

function App() {
  const [audioFiles, setAudioFiles] = useState([]);
  const [customFolder, setCustomFolder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const audioRefs = useRef([]);

  useEffect(() => {
    loadAudioFiles();
  }, []);

  const loadAudioFiles = async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI) {
        const files = await window.electronAPI.getAudioFiles();
        setAudioFiles(files);
      }
    } catch (error) {
      console.error('Error loading audio files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      if (window.electronAPI) {
        const folderPath = await window.electronAPI.selectAudioFolder();
        if (folderPath) {
          setCustomFolder(folderPath);
          const files = await window.electronAPI.getAudioFilesFromPath(folderPath);
          setAudioFiles(files);
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleRefresh = () => {
    if (customFolder) {
      window.electronAPI.getAudioFilesFromPath(customFolder).then(files => {
        setAudioFiles(files);
      });
    } else {
      loadAudioFiles();
    }
  };

  const pauseAllAudio = () => {
    audioRefs.current.forEach(audio => {
      if (audio && !audio.paused) {
        audio.pause();
      }
    });
  };

  const handleAudioRef = (index) => (ref) => {
    audioRefs.current[index] = ref;
  };

  const channels = [
    { id: 1, title: 'Background Music' },
    { id: 2, title: 'Performance 1' },
    { id: 3, title: 'Performance 2' },
    { id: 4, title: 'Performance 3' },
    { id: 5, title: 'Performance 4' },
    { id: 6, title: 'Sound Effects' }
  ];

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Dream Live Pro</h1>
          <p className="app-subtitle">Maid Cafe Performance Controller</p>
        </div>
        <div className="header-controls">
          <button className="folder-btn" onClick={handleSelectFolder} title="Select Audio Folder">
            <FolderOpen size={20} />
            <span>Select Folder</span>
          </button>
          <button className="refresh-btn" onClick={handleRefresh} title="Refresh Audio Files">
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      {customFolder && (
        <div className="folder-info">
          <span>Audio Folder: {customFolder}</span>
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading audio files...</p>
        </div>
      ) : (
        <>
          <main className="channels-container">
            {channels.map((channel, index) => (
              <AudioChannel
                key={channel.id}
                channelId={channel.id}
                title={channel.title}
                audioFiles={audioFiles}
                onAudioRef={handleAudioRef(index)}
              />
            ))}
          </main>

          <footer className="app-footer">
            <button className="pause-all-btn" onClick={pauseAllAudio}>
              <Pause size={24} />
              <span>Pause All Audio</span>
            </button>
            <div className="footer-info">
              <span>{audioFiles.length} audio files available</span>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
