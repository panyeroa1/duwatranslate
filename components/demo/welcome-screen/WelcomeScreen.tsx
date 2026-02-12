/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import './WelcomeScreen.css';
import { useLogStore, useSettings } from '../../../lib/state';

const WelcomeScreen: React.FC = () => {
  const turns = useLogStore(state => state.turns);
  const { language1 } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Render all turns to show sequence
  // Filter out empty turns or system instructions if any
  const visibleTurns = turns.filter(turn => turn.role === 'user' || turn.role === 'agent');

  if (visibleTurns.length === 0) {
    return (
      <div className="welcome-screen empty">
        <div className="welcome-content">
          <p className="placeholder-text">Waiting for conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-content" ref={scrollRef}>
        <div className="translation-list">
          {visibleTurns.map((turn, index) => {
            const isLast = index === visibleTurns.length - 1;
            const showCursor = isLast && !turn.isFinal;

            // Default check for user
            if (turn.role === 'user') {
              return (
                <div key={index} className="translation-item user-transcript">
                  <p className="transcript-text">
                    {turn.text}
                  </p>
                </div>
              );
            }

            // Agent Turn Parsing considering [LANG:...]
            const match = turn.text.match(/^\[LANG:(.+?)\]\s*(.*)/s);
            let displayRole = 'visitor-color';
            let displayText = turn.text;

            if (match) {
              const detectedLang = match[1].trim();
              displayText = match[2];

              if (detectedLang.toLowerCase() === language1.toLowerCase()) {
                displayRole = 'staff-color';
              } else {
                displayRole = 'visitor-color';
              }
            }
            // If no match, we typically wait or it's a raw output. 
            // We can default to visitor or handle it.
            // If it's the *very* beginning of a stream, it might not have the tag yet.

            return (
              <div key={index} className={`translation-item ${displayRole}`}>
                <p className="transcript-text">
                  {displayText}
                  {showCursor && <span className="cursor"></span>}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
