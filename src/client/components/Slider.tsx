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
        "flex",
        horizontal && "w-full flex-col",
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
          horizontal && "group h-6 w-full",
          state.isDisabled && "opacity-40"
        )}
      >
        <div className="relative top-1/2 h-[5px] w-full -translate-y-1/2 rounded-full bg-gray-300">
          <Thumb index={0} state={state} trackRef={trackRef} />
        </div>
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
    <>
      <div
        {...thumbProps}
        className={cx(
          "absolute top-0 block h-full rounded-full bg-gray-500 group-hover:bg-indigo-600",
          isFocusVisible && "!bg-indigo-600"
        )}
        style={{
          width: `${state.getThumbPercent(0) * 100}%`,
        }}
      ></div>
      <div
        {...thumbProps}
        className={cx(
          "top-1/2 h-[12px] w-[12px] rounded-full border border-gray-500 bg-indigo-100 opacity-0 group-hover:opacity-100",
          isDragging &&
            "shadow-[0_0_0_1px_rgba(255,255,255)_inset,1px_1px_4px_1px_rgba(0,0,0,0.3)_inset]",
          isFocusVisible && "ring-3 opacity-100 ring ring-offset-1"
        )}
      >
        <VisuallyHidden>
          <input ref={inputRef} {...mergeProps(inputProps, focusProps)} />
        </VisuallyHidden>
      </div>
    </>
  );
}