import React, { RefObject } from "react";
import { useSliderState, SliderState } from "react-stately";

import {
  mergeProps,
  useFocusRing,
  useNumberFormatter,
  useSlider,
  useSliderThumb,
  VisuallyHidden,
  AriaSliderProps,
} from "react-aria";
import cx from "classnames";

export interface SliderProps
  extends Omit<AriaSliderProps<number | number[]>, "numberFormatter"> {
  onMouseDown?(): void;
  onMouseUp?(): void;
}

export function Slider(props: SliderProps) {
  let trackRef = React.useRef(null);
  let numberFormatter = useNumberFormatter();
  let state = useSliderState({ ...props, numberFormatter });
  let { groupProps, trackProps, labelProps, outputProps } = useSlider(
    props,
    state,
    trackRef
  );

  const horizontal = state.orientation === "horizontal";
  const vertical = state.orientation === "vertical";

  return (
    <div
      {...groupProps}
      onMouseDown={props.onMouseDown}
      onMouseUp={props.onMouseUp}
      className={cx(
        "slider",
        "flex",
        horizontal && "flex-col w-full",
        vertical && "h-[150px]"
      )}
    >
      {/* Create a container for the label and output element. */}
      {props.label && (
        <div className={cx("label-container", "flex justify-between")}>
          <label {...labelProps}>{props.label}</label>
          <output {...outputProps}>{state.getThumbValueLabel(0)}</output>
        </div>
      )}
      {/* The track element holds the visible track line and the thumb. */}
      <div
        {...trackProps}
        ref={trackRef}
        className={cx(
          horizontal && "h-[30px] w-full",
          state.isDisabled && "opacity-40",
          `track ${state.isDisabled ? "disabled" : ""}`
        )}
      >
        <div className="block absolute bg-gray-400 h-1 w-full top-1/2 -translate-y-1/2"></div>
        <Thumb index={0} state={state} trackRef={trackRef} />
      </div>
    </div>
  );
}

interface ThumbProps {
  index: number;
  trackRef: RefObject<Element>;
  state: SliderState;
}
function Thumb(props: ThumbProps) {
  let { state, trackRef, index } = props;
  let inputRef = React.useRef(null);
  let { thumbProps, inputProps, isDragging } = useSliderThumb(
    {
      index,
      trackRef,
      inputRef,
    },
    state
  );

  let { focusProps, isFocusVisible } = useFocusRing();
  return (
    <div
      {...thumbProps}
      className={cx(
        "w-[20px] h-[20px] rounded-full bg-gray-400 top-1/2",
        isDragging && "bg-gray-600",
        isFocusVisible && "bg-orange-400",
        `thumb ${isFocusVisible ? "focus" : ""} ${isDragging ? "dragging" : ""}`
      )}
    >
      <VisuallyHidden>
        <input ref={inputRef} {...mergeProps(inputProps, focusProps)} />
      </VisuallyHidden>
    </div>
  );
}
