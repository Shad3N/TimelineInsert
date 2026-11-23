'use client';

import { useState } from 'react';

/** Earliest year the slider reaches; a negative year is BCE. */
const earliestSliderYear = -3000;

const thumbClassName =
	'pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gray-900 dark:[&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-900 dark:[&::-webkit-slider-thumb]:bg-white';

/** Slider position of a year; positions count astronomically, so they have no gap at year 0. */
function yearToSliderPosition(year: number): number {
	return year < 0 ? year + 1 : year;
}

function sliderPositionToYear(position: number): number {
	return position <= 0 ? position - 1 : position;
}

function formatYear(year: number): string {
	return year < 0 ? `${-year} BCE` : String(year);
}

/**
 * Two-handle year slider submitting `fromYear` and `toYear`; a handle at its end of the track
 * submits an empty value, so the range stays open on that side.
 */
export function YearRangeSlider({
	latestSliderYear,
	defaultFromYear,
	defaultToYear
}: {
	latestSliderYear: number;
	defaultFromYear: number | undefined;
	defaultToYear: number | undefined;
}) {
	const minimumPosition = yearToSliderPosition(earliestSliderYear);
	const maximumPosition = yearToSliderPosition(latestSliderYear);
	const [startPosition, setStartPosition] = useState(
		yearToSliderPosition(defaultFromYear ?? earliestSliderYear)
	);
	const [endPosition, setEndPosition] = useState(
		yearToSliderPosition(defaultToYear ?? latestSliderYear)
	);
	const startIsOpen = startPosition <= minimumPosition;
	const endIsOpen = endPosition >= maximumPosition;

	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="font-medium">Years</legend>
			<span className="text-sm">
				{startIsOpen
					? 'Any start'
					: formatYear(sliderPositionToYear(startPosition))}{' '}
				–{' '}
				{endIsOpen ? 'any end' : formatYear(sliderPositionToYear(endPosition))}
			</span>
			<div className="relative h-6">
				<div className="absolute inset-x-0 top-2.5 h-1 rounded bg-gray-300 dark:bg-gray-700" />
				<input
					type="range"
					min={minimumPosition}
					max={maximumPosition}
					value={startPosition}
					onChange={event =>
						setStartPosition(Math.min(Number(event.target.value), endPosition))
					}
					className={`${thumbClassName} ${startPosition === maximumPosition ? 'z-10' : ''}`}
				/>
				<input
					type="range"
					min={minimumPosition}
					max={maximumPosition}
					value={endPosition}
					onChange={event =>
						setEndPosition(Math.max(Number(event.target.value), startPosition))
					}
					className={thumbClassName}
				/>
			</div>
			<input
				type="hidden"
				name="fromYear"
				value={startIsOpen ? '' : sliderPositionToYear(startPosition)}
			/>
			<input
				type="hidden"
				name="toYear"
				value={endIsOpen ? '' : sliderPositionToYear(endPosition)}
			/>
		</fieldset>
	);
}
