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

  // Auto-scroll to bottom on new updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleTurns]);

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

            // Agent Turn - Render text as-is (clean output)
            return (
              <div key={index} className="translation-item visitor-color">
                <p className="transcript-text">
                  {turn.text}
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
