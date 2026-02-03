import React, { useState, useEffect } from 'react';
import './Header.css';

const Header = () => {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Rileva la piattaforma
    const platform = window.navigator.platform.toLowerCase();
    const userAgent = window.navigator.userAgent.toLowerCase();
    // Mac ha 'mac' nella piattaforma, Windows ha 'win'
    setIsMac(platform.includes('mac') || userAgent.includes('mac'));
  }, []);

  return (
    <header className={`header ${isMac ? 'mac' : 'windows'}`}>
    </header>
  );
};

export default Header;

