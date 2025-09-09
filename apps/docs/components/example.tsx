"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  ConstraintContext,
  DragMoveArgs,
  DragMoveEvent,
  LayerConstraintContext,
  Timeline,
  formatDurationDisplay,
} from "@repo/timeline";
import { Button } from "@repo/ui/button";

// Example 1: Video Editor Timeline with Constraints
const VideoEditorExample = () => {
  const [currentTime, setCurrentTime] = useState(5000);
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [videoLayers, setVideoLayers] = useState([
    { id: "intro", start: 0, end: 8000, type: "video" },
    { id: "main", start: 8500, end: 25000, type: "video" },
    { id: "outro", start: 25500, end: 30000, type: "video" },
  ]);
  const [audioLayers, setAudioLayers] = useState([
    { id: "music", start: 0, end: 30000, type: "audio" },
    { id: "voiceover", start: 3000, end: 22000, type: "audio" },
  ]);

  const constraints = useMemo(
    () => ({
      playhead: (time: number, context: ConstraintContext) => {
        // Snap playhead to keyframes
        const keyframes = [0, 5000, 10000, 15000, 20000, 25000, 30000];
        const closest = keyframes.reduce((prev, curr) =>
          Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev
        );
        return Math.abs(closest - time) < 200 ? closest : time;
      },
    }),
    []
  );

  const handleLayerConstraint = useCallback(
    (
      layerId: string,
      start: number,
      end: number,
      context: LayerConstraintContext
    ) => {
      // Prevent overlapping video layers
      const videoLayersInTrack = context.allLayers.filter(
        (l) =>
          l.id !== layerId &&
          videoLayers.find((v) => v.id === l.id)?.type === "video"
      );

      for (const layer of videoLayersInTrack) {
        if (start < layer.end && end > layer.start) {
          // Adjust to prevent overlap
          if (Math.abs(start - layer.end) < Math.abs(end - layer.start)) {
            start = layer.end;
          } else {
            end = layer.start;
          }
        }
      }

      return { start: Math.max(0, start), end: Math.max(start + 500, end) };
    },
    [videoLayers]
  );

  const updateVideoLayer = useCallback((event: DragMoveArgs) => {
    const { layerId, start: newStart, end: newEnd } = event;
    setVideoLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId
          ? { ...layer, start: newStart, end: newEnd }
          : layer
      )
    );
  }, []);

  const updateAudioLayer = useCallback((event: DragMoveArgs) => {
    const { layerId, start: newStart, end: newEnd } = event;
    setAudioLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId
          ? { ...layer, start: newStart, end: newEnd }
          : layer
      )
    );
  }, []);

  return (
    <div className="space-y-4 p-6 rounded-lg">
      <h3 className="text-lg font-semibold">Video Editor Timeline</h3>
      <div className="flex gap-4 items-center">
        <Button onClick={() => setCurrentTime(0)}>Go to Start</Button>
        <span className="text-sm text-white">
          Current: {formatDurationDisplay(currentTime)}
        </span>
      </div>

      <Timeline.Root
        currentTime={currentTime}
        onTimeChange={setCurrentTime}
        timelineBounds={50000}
        constraints={constraints}
        step={100}
      >
        <Timeline.Content>
          <Timeline.Ruler className="bg-gray-100" />
          <Timeline.Playhead />

          {/* Video Track */}
          <Timeline.Track
            id="video"
            label="Video Track"
            selected={selectedTrack === "video"}
            onSelect={setSelectedTrack}
            onConstrainLayer={handleLayerConstraint}
          >
            {videoLayers.map((layer) => (
              <Timeline.Track.Layer
                key={layer.id}
                id={layer.id}
                start={layer.start}
                end={layer.end}
                onDrag={updateVideoLayer}
                onResize={updateVideoLayer}
                className="bg-blue-200 border-blue-400"
              >
                <div className="px-2 py-1 text-xs font-medium text-blue-800 truncate">
                  {layer.id}
                </div>
                <Timeline.Track.Layer.Tooltip>
                  {({ start, end }) => (
                    <span>
                      {layer.id}: {formatDurationDisplay(start)} -{" "}
                      {formatDurationDisplay(end)}
                    </span>
                  )}
                </Timeline.Track.Layer.Tooltip>
              </Timeline.Track.Layer>
            ))}
          </Timeline.Track>

          {/* Audio Track */}
          <Timeline.Track
            id="audio"
            label="Audio Track"
            selected={selectedTrack === "audio"}
            onSelect={setSelectedTrack}
          >
            {audioLayers.map((layer) => (
              <Timeline.Track.Layer
                key={layer.id}
                id={layer.id}
                start={layer.start}
                end={layer.end}
                onDrag={updateAudioLayer}
                onResize={updateAudioLayer}
                className="bg-green-200 border-green-400"
              >
                <div className="px-2 py-1 text-xs font-medium text-green-800 truncate">
                  {layer.id}
                </div>
                <Timeline.Track.Layer.Tooltip>
                  {({ start, end }) => (
                    <span>
                      {layer.id}: {formatDurationDisplay(start)} -{" "}
                      {formatDurationDisplay(end)}
                    </span>
                  )}
                </Timeline.Track.Layer.Tooltip>
              </Timeline.Track.Layer>
            ))}
          </Timeline.Track>
        </Timeline.Content>
      </Timeline.Root>
    </div>
  );
};

// // Example 2: Music Production Timeline with Reordering
// const MusicProductionExample = () => {
//   const [tracks, setTracks] = useState([
//     {
//       id: "drums",
//       label: "Drums",
//       layers: [{ id: "d1", start: 0, end: 32000 }],
//     },
//     {
//       id: "bass",
//       label: "Bass",
//       layers: [{ id: "b1", start: 8000, end: 28000 }],
//     },
//     {
//       id: "guitar",
//       label: "Guitar",
//       layers: [{ id: "g1", start: 16000, end: 32000 }],
//     },
//     {
//       id: "vocals",
//       label: "Vocals",
//       layers: [{ id: "v1", start: 8000, end: 24000 }],
//     },
//   ]);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [currentTime, setCurrentTime] = useState(0);

//   const handleReorder = useCallback((newOrder, movedId, fromIndex, toIndex) => {
//     setTracks((prev) => {
//       const reordered = newOrder
//         .map((id) => prev.find((t) => t.id === id))
//         .filter(Boolean);
//       return reordered;
//     });
//   }, []);

//   const updateTrackLayer = useCallback((trackId, layerId, start, end) => {
//     setTracks((prev) =>
//       prev.map((track) =>
//         track.id === trackId
//           ? {
//               ...track,
//               layers: track.layers.map((layer) =>
//                 layer.id === layerId ? { ...layer, start, end } : layer
//               ),
//             }
//           : track
//       )
//     );
//   }, []);

//   const getTrackColor = (trackType) => {
//     const colors = {
//       drums: "bg-red-200 border-red-400",
//       bass: "bg-purple-200 border-purple-400",
//       guitar: "bg-orange-200 border-orange-400",
//       vocals: "bg-indigo-200 border-indigo-400",
//     };
//     return colors[trackType] || "bg-gray-200 border-gray-400";
//   };

//   return (
//     <div className="space-y-4 p-6 rounded-lg">
//       <h3 className="text-lg font-semibold">Music Production Timeline</h3>
//       <div className="flex gap-4 items-center">
//         <Button
//           onClick={() => setIsPlaying(!isPlaying)}
//           className={
//             isPlaying
//               ? "bg-red-500 hover:bg-red-600"
//               : "bg-green-500 hover:bg-green-600"
//           }
//         >
//           {isPlaying ? "Pause" : "Play"}
//         </Button>
//         <span className="text-sm text-gray-600">
//           {formatDurationDisplay(currentTime)} / {formatDurationDisplay(32000)}
//         </span>
//       </div>

//       <Timeline.Root
//         currentTime={currentTime}
//         onTimeChange={setCurrentTime}
//         onPlay={() => setIsPlaying(true)}
//         onPause={() => setIsPlaying(false)}
//         timelineBounds={32000}
//         step={250}
//         scaleConfig={{ type: "fixed", fixedPxPerSecond: 60 }}
//       >
//         <Timeline.Content>
//           <Timeline.Ruler />
//           <Timeline.Playhead />

//           <Timeline.Reorder
//             onReorder={handleReorder}
//             className="mt-8 space-y-2"
//           >
//             {tracks.map((track) => (
//               <Timeline.Track
//                 key={track.id}
//                 id={track.id}
//                 label={track.label}
//                 className="relative"
//               >
//                 <div className="absolute left-2 top-2 text-xs font-medium text-gray-700 z-10">
//                   {track.label}
//                 </div>
//                 {track.layers.map((layer) => (
//                   <Timeline.Track.Layer
//                     key={layer.id}
//                     id={layer.id}
//                     start={layer.start}
//                     end={layer.end}
//                     onDrag={(start, end) =>
//                       updateTrackLayer(track.id, layer.id, start, end)
//                     }
//                     onResize={(start, end) =>
//                       updateTrackLayer(track.id, layer.id, start, end)
//                     }
//                     className={getTrackColor(track.id)}
//                   />
//                 ))}
//               </Timeline.Track>
//             ))}
//           </Timeline.Reorder>
//         </Timeline.Content>
//       </Timeline.Root>
//     </div>
//   );
// };

// // Example 3: Animation Timeline with Keyframes
// const AnimationTimelineExample = () => {
//   const [currentTime, setCurrentTime] = useState(0);
//   const [selectedProperty, setSelectedProperty] = useState("opacity");
//   const [keyframes, setKeyframes] = useState({
//     opacity: [
//       { time: 0, value: 0 },
//       { time: 1000, value: 1 },
//       { time: 3000, value: 0.5 },
//       { time: 5000, value: 1 },
//     ],
//     scale: [
//       { time: 0, value: 1 },
//       { time: 2000, value: 1.5 },
//       { time: 4000, value: 1 },
//     ],
//     rotation: [
//       { time: 0, value: 0 },
//       { time: 2500, value: 180 },
//       { time: 5000, value: 360 },
//     ],
//   });

//   const properties = ["opacity", "scale", "rotation"];

//   const addKeyframe = useCallback((property, time) => {
//     setKeyframes((prev) => ({
//       ...prev,
//       [property]: [...prev[property], { time, value: 1 }].sort(
//         (a, b) => a.time - b.time
//       ),
//     }));
//   }, []);

//   const removeKeyframe = useCallback((property, index) => {
//     setKeyframes((prev) => ({
//       ...prev,
//       [property]: prev[property].filter((_, i) => i !== index),
//     }));
//   }, []);

//   const getPropertyColor = (property) => {
//     const colors = {
//       opacity: "bg-blue-200 border-blue-400",
//       scale: "bg-green-200 border-green-400",
//       rotation: "bg-yellow-200 border-yellow-400",
//     };
//     return colors[property];
//   };

//   return (
//     <div className="space-y-4 p-6 rounded-lg">
//       <h3 className="text-lg font-semibold">Animation Timeline</h3>
//       <div className="flex gap-4 items-center">
//         <div className="flex gap-2">
//           {properties.map((prop) => (
//             <Button
//               key={prop}
//               size="sm"
//               variant={selectedProperty === prop ? "default" : "outline"}
//               onClick={() => setSelectedProperty(prop)}
//             >
//               {prop}
//             </Button>
//           ))}
//         </div>
//         <Button
//           size="sm"
//           onClick={() => addKeyframe(selectedProperty, currentTime)}
//         >
//           Add Keyframe
//         </Button>
//       </div>

//       <Timeline.Root
//         currentTime={currentTime}
//         onTimeChange={setCurrentTime}
//         timelineBounds={6000}
//         step={50}
//         scaleConfig={{
//           type: "auto",
//           fixedPxPerSecond: 100,
//           maxPxPerSecond: 200,
//         }}
//       >
//         <Timeline.Content>
//           <Timeline.Ruler />
//           <Timeline.Playhead />

//           <div className="mt-8 space-y-1">
//             {properties.map((property) => (
//               <Timeline.Track
//                 key={property}
//                 id={property}
//                 label={property}
//                 selected={selectedProperty === property}
//                 onSelect={setSelectedProperty}
//                 className="h-12"
//               >
//                 <div className="absolute left-2 top-1 text-xs font-medium capitalize z-10">
//                   {property}
//                 </div>
//                 {keyframes[property].map((keyframe, index) => (
//                   <Timeline.Track.Layer
//                     key={`${property}-${index}`}
//                     id={`${property}-${index}`}
//                     start={keyframe.time - 25}
//                     end={keyframe.time + 25}
//                     draggable={true}
//                     resizable={false}
//                     className={`${getPropertyColor(property)} cursor-pointer`}
//                     onDrag={(start) => {
//                       const newKeyframes = [...keyframes[property]];
//                       newKeyframes[index] = { ...keyframe, time: start + 25 };
//                       setKeyframes((prev) => ({
//                         ...prev,
//                         [property]: newKeyframes.sort(
//                           (a, b) => a.time - b.time
//                         ),
//                       }));
//                     }}
//                   >
//                     <div className="w-full h-full rounded-full border-2 border-white bg-current flex items-center justify-center">
//                       <div className="w-2 h-2 rounded-full" />
//                     </div>
//                     <Timeline.Track.Layer.Tooltip>
//                       {() => (
//                         <div className="flex items-center gap-2">
//                           <span>
//                             {property}: {keyframe.value}
//                           </span>
//                           <Button
//                             size="sm"
//                             variant="destructive"
//                             onClick={() => removeKeyframe(property, index)}
//                           >
//                             Delete
//                           </Button>
//                         </div>
//                       )}
//                     </Timeline.Track.Layer.Tooltip>
//                   </Timeline.Track.Layer>
//                 ))}
//               </Timeline.Track>
//             ))}
//           </div>
//         </Timeline.Content>
//       </Timeline.Root>
//     </div>
//   );
// };

// // Example 4: Project Timeline with Dependencies
// const ProjectTimelineExample = () => {
//   const [currentTime, setCurrentTime] = useState(0);
//   const [tasks, setTasks] = useState([
//     { id: "design", name: "UI Design", start: 0, end: 14000, dependencies: [] },
//     {
//       id: "frontend",
//       name: "Frontend Dev",
//       start: 12000,
//       end: 35000,
//       dependencies: ["design"],
//     },
//     {
//       id: "backend",
//       name: "Backend API",
//       start: 7000,
//       end: 28000,
//       dependencies: [],
//     },
//     {
//       id: "testing",
//       name: "QA Testing",
//       start: 30000,
//       end: 42000,
//       dependencies: ["frontend", "backend"],
//     },
//     {
//       id: "deploy",
//       name: "Deployment",
//       start: 40000,
//       end: 45000,
//       dependencies: ["testing"],
//     },
//   ]);

//   const validateTaskDependencies = useCallback(
//     (taskId, newStart, newEnd) => {
//       const task = tasks.find((t) => t.id === taskId);
//       if (!task) return { start: newStart, end: newEnd };

//       let adjustedStart = newStart;
//       let adjustedEnd = newEnd;

//       // Check dependencies - task cannot start before dependencies end
//       for (const depId of task.dependencies) {
//         const dependency = tasks.find((t) => t.id === depId);
//         if (dependency && adjustedStart < dependency.end) {
//           const offset = adjustedEnd - adjustedStart;
//           adjustedStart = dependency.end;
//           adjustedEnd = adjustedStart + offset;
//         }
//       }

//       // Check dependent tasks - they cannot start before this task ends
//       const dependentTasks = tasks.filter((t) =>
//         t.dependencies.includes(taskId)
//       );
//       for (const dependent of dependentTasks) {
//         if (dependent.start < adjustedEnd) {
//           // We would need to adjust dependent tasks, but for this example we'll prevent the change
//           return { start: task.start, end: task.end };
//         }
//       }

//       return { start: adjustedStart, end: adjustedEnd };
//     },
//     [tasks]
//   );

//   const updateTask = useCallback(
//     (taskId, newStart, newEnd) => {
//       const validated = validateTaskDependencies(taskId, newStart, newEnd);
//       setTasks((prev) =>
//         prev.map((task) =>
//           task.id === taskId
//             ? { ...task, start: validated.start, end: validated.end }
//             : task
//         )
//       );
//     },
//     [validateTaskDependencies]
//   );

//   const getTaskStatus = (task, currentTime) => {
//     if (currentTime < task.start) return "pending";
//     if (currentTime >= task.start && currentTime < task.end) return "active";
//     return "completed";
//   };

//   const getTaskColor = (status) => {
//     const colors = {
//       pending: "bg-gray-200 border-gray-400",
//       active: "bg-blue-200 border-blue-400",
//       completed: "bg-green-200 border-green-400",
//     };
//     return colors[status];
//   };

//   return (
//     <div className="space-y-4 p-6 rounded-lg">
//       <h3 className="text-lg font-semibold">Project Timeline</h3>
//       <div className="flex gap-4 items-center">
//         <Button onClick={() => setCurrentTime(0)}>Project Start</Button>
//         <Button onClick={() => setCurrentTime(45000)}>Project End</Button>
//         <span className="text-sm text-gray-600">
//           Day: {Math.floor(currentTime / 1000) + 1}
//         </span>
//       </div>

//       <Timeline.Root
//         currentTime={currentTime}
//         onTimeChange={setCurrentTime}
//         timelineBounds={50000}
//         step={1000}
//         minGap={2000}
//         scaleConfig={{ type: "container" }}
//       >
//         <Timeline.Content>
//           <Timeline.Ruler />
//           <Timeline.Playhead />
//           <Timeline.LeftHandle />
//           <Timeline.RightHandle />

//           <div className="mt-12 space-y-2">
//             {tasks.map((task) => {
//               const status = getTaskStatus(task, currentTime);
//               return (
//                 <Timeline.Track key={task.id} id={task.id} label={task.name}>
//                   <Timeline.Track.Layer
//                     id={task.id}
//                     start={task.start}
//                     end={task.end}
//                     onDrag={updateTask}
//                     onResize={updateTask}
//                     onConstrainLayer={validateTaskDependencies}
//                     className={getTaskColor(status)}
//                   >
//                     <div className="px-2 py-1 text-xs font-medium truncate">
//                       {task.name}
//                       {task.dependencies.length > 0 && (
//                         <div className="text-xs opacity-70 mt-1">
//                           Depends on: {task.dependencies.join(", ")}
//                         </div>
//                       )}
//                     </div>
//                     <Timeline.Track.Layer.Tooltip>
//                       {({ start, end }) => (
//                         <div>
//                           <div className="font-medium">{task.name}</div>
//                           <div>
//                             Duration: {Math.floor((end - start) / 1000)} days
//                           </div>
//                           <div>Status: {status}</div>
//                         </div>
//                       )}
//                     </Timeline.Track.Layer.Tooltip>
//                   </Timeline.Track.Layer>
//                 </Timeline.Track>
//               );
//             })}
//           </div>
//         </Timeline.Content>
//       </Timeline.Root>
//     </div>
//   );
// };

// // Example 5: Multi-Camera Video Timeline
// const MultiCameraExample = () => {
//   const [currentTime, setCurrentTime] = useState(15000);
//   const [selectedCamera, setSelectedCamera] = useState("cam1");
//   const [cameraFeeds] = useState([
//     {
//       id: "cam1",
//       name: "Camera 1 - Wide",
//       clips: [
//         { id: "c1-1", start: 0, end: 30000, active: true },
//         { id: "c1-2", start: 35000, end: 60000, active: false },
//       ],
//     },
//     {
//       id: "cam2",
//       name: "Camera 2 - Medium",
//       clips: [
//         { id: "c2-1", start: 5000, end: 40000, active: false },
//         { id: "c2-2", start: 42000, end: 65000, active: true },
//       ],
//     },
//     {
//       id: "cam3",
//       name: "Camera 3 - Close",
//       clips: [
//         { id: "c3-1", start: 10000, end: 25000, active: false },
//         { id: "c3-2", start: 30000, end: 55000, active: true },
//       ],
//     },
//   ]);

//   const [timeline, setTimeline] = useState([
//     { start: 0, end: 15000, camera: "cam1" },
//     { start: 15000, end: 35000, camera: "cam3" },
//     { start: 35000, end: 50000, camera: "cam2" },
//   ]);

//   const switchCamera = useCallback((cameraId: string, time: number) => {
//     setTimeline((prev) => {
//       // Find the segment that contains this time
//       const segmentIndex = prev.findIndex(
//         (segment) => time >= segment.start && time < segment.end
//       );

//       if (segmentIndex === -1) return prev;

//       const segment = prev[segmentIndex];
//       if (!segment) return prev;
//       if (segment.camera === cameraId) return prev;

//       // Split the segment at the current time
//       const newSegments = [...prev];
//       if (time > segment.start && time < segment.end) {
//         newSegments.splice(
//           segmentIndex,
//           1,
//           { ...segment, end: time },
//           { start: time, end: segment.end, camera: cameraId }
//         );
//       } else {
//         newSegments[segmentIndex] = { ...segment, camera: cameraId };
//       }

//       return newSegments;
//     });
//   }, []);

//   return (
//     <div className="space-y-4 p-6 rounded-lg">
//       <h3 className="text-lg font-semibold">Multi-Camera Video Timeline</h3>
//       <div className="flex gap-4 items-center">
//         <div className="flex gap-2">
//           {cameraFeeds.map((camera) => (
//             <Button
//               key={camera.id}
//               size="sm"
//               variant={selectedCamera === camera.id ? "default" : "outline"}
//               onClick={() => {
//                 setSelectedCamera(camera.id);
//                 switchCamera(camera.id, currentTime);
//               }}
//             >
//               {camera.name}
//             </Button>
//           ))}
//         </div>
//         <span className="text-sm text-gray-600">
//           Active:{" "}
//           {timeline.find((t) => currentTime >= t.start && currentTime < t.end)
//             ?.camera || "None"}
//         </span>
//       </div>

//       <Timeline.Root
//         currentTime={currentTime}
//         onTimeChange={setCurrentTime}
//         timelineBounds={70000}
//         step={500}
//         scaleConfig={{ type: "fixed", fixedPxPerSecond: 40 }}
//       >
//         <Timeline.Content>
//           <Timeline.Ruler />
//           <Timeline.Playhead />

//           {/* Program Timeline - Shows active camera switches */}
//           <Timeline.Track
//             id="program"
//             label="Program"
//             className="mt-8 h-16 bg-yellow-50"
//           >
//             <div className="absolute left-2 top-2 text-sm font-bold text-yellow-800 z-10">
//               Program Output
//             </div>
//             {timeline.map((segment, index) => (
//               <Timeline.Track.Layer
//                 key={`program-${index}`}
//                 id={`program-${index}`}
//                 start={segment.start}
//                 end={segment.end}
//                 draggable={false}
//                 resizable={false}
//                 className="bg-yellow-200 border-yellow-400"
//               >
//                 <div className="px-2 py-1 text-xs font-medium text-yellow-800 text-center">
//                   {cameraFeeds.find((c) => c.id === segment.camera)?.name}
//                 </div>
//               </Timeline.Track.Layer>
//             ))}
//           </Timeline.Track>

//           {/* Individual Camera Tracks */}
//           <div className="mt-4 space-y-2">
//             {cameraFeeds.map((camera) => (
//               <Timeline.Track
//                 key={camera.id}
//                 id={camera.id}
//                 label={camera.name}
//                 selected={selectedCamera === camera.id}
//                 onSelect={setSelectedCamera}
//               >
//                 <div className="absolute left-2 top-2 text-xs font-medium z-10">
//                   {camera.name}
//                 </div>
//                 {camera.clips.map((clip) => (
//                   <Timeline.Track.Layer
//                     key={clip.id}
//                     id={clip.id}
//                     start={clip.start}
//                     end={clip.end}
//                     draggable={false}
//                     resizable={false}
//                     className={`${clip.active ? "bg-green-200 border-green-400" : "bg-gray-200 border-gray-400"}`}
//                   >
//                     <Timeline.Track.Layer.Tooltip>
//                       {({ start, end }) => (
//                         <div>
//                           <div className="font-medium">{camera.name}</div>
//                           <div>
//                             Clip: {formatDurationDisplay(start)} -{" "}
//                             {formatDurationDisplay(end)}
//                           </div>
//                           <div>
//                             Status: {clip.active ? "Recording" : "Standby"}
//                           </div>
//                         </div>
//                       )}
//                     </Timeline.Track.Layer.Tooltip>
//                   </Timeline.Track.Layer>
//                 ))}
//               </Timeline.Track>
//             ))}
//           </div>
//         </Timeline.Content>
//       </Timeline.Root>
//     </div>
//   );
// };

// // Example 6: Advanced Audio Mixing Timeline
// const AudioMixingExample = () => {
//   const [currentTime, setCurrentTime] = useState(0);
//   const [zoom, setZoom] = useState(1);
//   const [selectedTrack, setSelectedTrack] = useState<string>("");

//   const handleSelectedTrack = useCallback(
//     (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
//       e.stopPropagation();
//       setSelectedTrack(id);
//     },
//     []
//   );

//   const [tracks] = useState([
//     {
//       id: "master",
//       name: "Master",
//       type: "master",
//       volume: 0.8,
//       muted: false,
//       effects: ["compressor", "eq"],
//       clips: [{ id: "m1", start: 0, end: 180000, gain: 1 }],
//     },
//     {
//       id: "drums",
//       name: "Drum Kit",
//       type: "audio",
//       volume: 0.9,
//       muted: false,
//       effects: ["gate", "compressor"],
//       clips: [
//         { id: "d1", start: 0, end: 64000, gain: 1 },
//         { id: "d2", start: 68000, end: 132000, gain: 0.8 },
//         { id: "d3", start: 136000, end: 180000, gain: 1.2 },
//       ],
//     },
//     {
//       id: "bass",
//       name: "Bass Guitar",
//       type: "audio",
//       volume: 0.7,
//       muted: false,
//       effects: ["eq", "compressor"],
//       clips: [{ id: "b1", start: 8000, end: 172000, gain: 1 }],
//     },
//     {
//       id: "lead",
//       name: "Lead Vocal",
//       type: "vocal",
//       volume: 0.85,
//       muted: false,
//       effects: ["reverb", "delay", "de-esser"],
//       clips: [
//         { id: "v1", start: 16000, end: 80000, gain: 1 },
//         { id: "v2", start: 96000, end: 160000, gain: 0.9 },
//       ],
//     },
//   ]);

//   const toggleMute = useCallback((trackId: string) => {
//     // This would update track mute state in a real implementation
//     console.log(`Toggle mute for ${trackId}`);
//   }, []);

//   type ClipType = "master" | "audio" | "vocal";

//   const getTrackColor = (type: ClipType): string => {
//     const colors = {
//       master: "bg-red-100 border-red-300",
//       audio: "bg-blue-100 border-blue-300",
//       vocal: "bg-purple-100 border-purple-300",
//     } as const;

//     return colors[type as keyof typeof colors] ?? "bg-gray-100 border-gray-300";
//   };

//   const getClipColor = (type: ClipType, muted: boolean): string => {
//     if (muted) {
//       return "bg-gray-300 border-gray-500 opacity-50";
//     }

//     const colors: Record<ClipType, string> = {
//       master: "bg-red-200 border-red-400",
//       audio: "bg-blue-200 border-blue-400",
//       vocal: "bg-purple-200 border-purple-400",
//     };

//     return colors[type] ?? "bg-gray-200 border-gray-400";
//   };

//   return (
//     <div className="space-y-4 p-6 rounded-lg">
//       <h3 className="text-lg font-semibold">Advanced Audio Mixing Timeline</h3>
//       <div className="flex gap-4 items-center justify-between">
//         <div className="flex gap-2 items-center">
//           <Button size="sm" onClick={() => setZoom(zoom * 1.5)}>
//             Zoom In
//           </Button>
//           <Button size="sm" onClick={() => setZoom(zoom / 1.5)}>
//             Zoom Out
//           </Button>
//           <span className="text-sm text-gray-600">
//             Zoom: {zoom.toFixed(1)}x
//           </span>
//         </div>
//         <div className="flex gap-2">
//           <Button size="sm" variant="outline">
//             Solo
//           </Button>
//           <Button size="sm" variant="outline">
//             Record
//           </Button>
//           <Button size="sm" className="bg-red-500 hover:bg-red-600">
//             {currentTime > 0 ? "Stop" : "Record"}
//           </Button>
//         </div>
//       </div>

//       <Timeline.Root
//         currentTime={currentTime}
//         onTimeChange={setCurrentTime}
//         timelineBounds={180000}
//         zoom={zoom}
//         onZoomChange={setZoom}
//         step={125}
//         scaleConfig={{
//           type: "auto",
//           fixedPxPerSecond: 30,
//           minPxPerSecond: 10,
//           maxPxPerSecond: 120,
//         }}
//       >
//         <Timeline.Content className="h-96">
//           <Timeline.Ruler />
//           <Timeline.Playhead />

//           <div className="mt-8 space-y-1">
//             {tracks.map((track) => (
//               <div key={track.id} className="flex">
//                 {/* Track Controls */}
//                 <div className="w-32 flex-shrink-0 p-2 bg-gray-800 text-white text-xs">
//                   <div className="font-medium mb-1 truncate">{track.name}</div>
//                   <div className="flex gap-1 mb-1">
//                     <button
//                       onClick={() => toggleMute(track.id)}
//                       className={`px-1 py-0.5 rounded text-xs ${
//                         track.muted ? "bg-red-600" : "bg-gray-600"
//                       }`}
//                     >
//                       M
//                     </button>
//                     <button className="px-1 py-0.5 bg-yellow-600 rounded text-xs">
//                       S
//                     </button>
//                   </div>
//                   <div className="text-xs opacity-75">
//                     Vol: {Math.round(track.volume * 100)}%
//                   </div>
//                 </div>

//                 {/* Timeline Track */}
//                 <div className="flex-1">
//                   <Timeline.Track
//                     id={track.id}
//                     label={track.name}
//                     selected={selectedTrack === track.id}
//                     onSelect={handleSelectedTrack}
//                     className={`h-16 ${getTrackColor(track.type as ClipType)}`}
//                   >
//                     {track.clips.map((clip) => (
//                       <Timeline.Track.Layer
//                         key={clip.id}
//                         id={clip.id}
//                         start={clip.start}
//                         end={clip.end}
//                         className={getClipColor(
//                           track.type as ClipType,
//                           track.muted
//                         )}
//                       >
//                         <div className="px-2 py-1 text-xs">
//                           <div className="font-medium truncate">
//                             {track.name} - Clip {clip.id.slice(-1)}
//                           </div>
//                           <div className="opacity-75">
//                             Gain: {clip.gain > 1 ? "+" : ""}
//                             {Math.round((clip.gain - 1) * 100)}%
//                           </div>
//                         </div>
//                         <Timeline.Track.Layer.Tooltip>
//                           {({ start, end }) => (
//                             <div>
//                               <div className="font-medium">{track.name}</div>
//                               <div>
//                                 Duration: {formatDurationDisplay(end - start)}
//                               </div>
//                               <div>Effects: {track.effects.join(", ")}</div>
//                               <div>Gain: {Math.round(clip.gain * 100)}%</div>
//                               <div>
//                                 Volume: {Math.round(track.volume * 100)}%
//                               </div>
//                             </div>
//                           )}
//                         </Timeline.Track.Layer.Tooltip>
//                       </Timeline.Track.Layer>
//                     ))}
//                   </Timeline.Track>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </Timeline.Content>
//       </Timeline.Root>
//     </div>
//   );
// };

const TimelineExamples = () => {
  const [activeExample, setActiveExample] = useState(0);

  const examples = [
    {
      name: "Video Editor",
      component: VideoEditorExample,
    },
    // {
    //   name: "Music Production",
    //   component: MusicProductionExample,
    // },
    // {
    //   name: "Animation",
    //   component: AnimationTimelineExample,
    // },
    // {
    //   name: "Project Management",
    //   component: ProjectTimelineExample,
    // },
    // {
    //   name: "Multi-Camera",
    //   component: MultiCameraExample,
    // },
    // {
    //   name: "Audio Mixing",
    //   component: AudioMixingExample,
    // },
  ] as const;

  const ActiveComponent = examples[activeExample]!.component;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4 font-mono">
          Timeline Component
        </h1>
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        {examples.map((example, index) => (
          <Button
            key={index}
            size="sm"
            variant={activeExample === index ? "default" : "outline"}
            onClick={() => setActiveExample(index)}
            className="text-sm"
          >
            {example.name}
          </Button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
};

export default TimelineExamples;
