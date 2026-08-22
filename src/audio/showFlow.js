export const SHOW_PHASE = Object.freeze({
  SETUP: 'setup',
  READY: 'ready',
  TRANSITIONING: 'transitioning',
  LIVE: 'live',
  PAUSED: 'paused',
  RESTORING: 'restoring',
  ERROR: 'error',
});

export { nextPlaylistIndex } from './playlist';

const reportPhase = (onPhase, phase) => {
  if (onPhase) onPhase(phase);
};

export async function startPerformanceFlow({
  lowerBackground,
  playPerformance,
  restoreBackground,
  onPhase,
}) {
  reportPhase(onPhase, SHOW_PHASE.TRANSITIONING);
  await lowerBackground();

  try {
    await playPerformance();
    reportPhase(onPhase, SHOW_PHASE.LIVE);
  } catch (error) {
    reportPhase(onPhase, SHOW_PHASE.RESTORING);
    try {
      await restoreBackground();
    } finally {
      reportPhase(onPhase, SHOW_PHASE.ERROR);
    }
    throw error;
  }
}

export async function finishPerformanceFlow({ restoreBackground, onPhase }) {
  reportPhase(onPhase, SHOW_PHASE.RESTORING);
  await restoreBackground();
  reportPhase(onPhase, SHOW_PHASE.READY);
}

export function getShowReadiness({
  outputReady = true,
  assignedPerformances,
}) {
  if (!outputReady) {
    return { phase: SHOW_PHASE.SETUP, label: 'Check sound', ready: false };
  }
  if (assignedPerformances < 1) {
    return { phase: SHOW_PHASE.SETUP, label: 'Assign a performance', ready: false };
  }
  return { phase: SHOW_PHASE.READY, label: 'Show ready', ready: true };
}

export function getShowDeckState({
  ready,
  assignments = [],
  completed = [],
  currentPerformance = null,
}) {
  const incompleteAssigned = assignments
    .map((assigned, index) => ({ assigned: Boolean(assigned), index }))
    .filter(({ assigned, index }) => assigned && !completed[index]);
  const isLive = Number.isInteger(currentPerformance) && currentPerformance >= 0;
  const nextPerformance = incompleteAssigned.find(({ index }) => (
    !isLive || index !== currentPerformance
  ));

  return {
    mode: isLive ? 'live' : (ready ? 'ready' : 'prep'),
    activePerformanceIndex: isLive ? currentPerformance : null,
    nextPerformanceIndex: nextPerformance?.index ?? null,
    remainingAssignedCount: incompleteAssigned.length,
  };
}
