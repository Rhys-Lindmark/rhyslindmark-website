#!/usr/bin/env python3
"""Rebuild the chart from explicit activity inputs, not chosen FTE endpoints.
Run: python3 scripts/build-digital-workforce.py [--check]
No third-party dependencies. --check verifies the checked-in artifact.
"""
import calendar
import datetime as dt
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'public/posts/ai2026-pt2'
MODEL = json.loads((DIR / 'digital-workforce-model.json').read_text())
HOURS = MODEL['human_hours_per_year']

def interpolate(rows, date):
    """Linear interpolation of inputs; no invented monthly observations."""
    time = dt.date.fromisoformat(date).toordinal()
    for a, b in zip(rows, rows[1:]):
        start, end = (dt.date.fromisoformat(r['date']).toordinal() for r in (a, b))
        if start <= time <= end:
            weight = (time - start) / (end - start)
            return {k: a[k] + (b[k] - a[k]) * weight for k in a if k != 'date'}
    raise ValueError('Date outside input anchors: ' + date)

def estimate(date):
    c = interpolate(MODEL['consumer']['anchors'], date)
    annual_work_messages = c['chatgpt_work_messages_per_day'] * c['all_platforms_factor'] * 365
    chat = annual_work_messages * c['general_share'] * c['general_human_minutes_per_task'] / c['general_messages_per_task'] * c['general_acceptance'] / (60 * HOURS)
    research = annual_work_messages * c['research_share'] * c['research_human_minutes_per_task'] / c['research_messages_per_task'] * c['research_acceptance'] / (60 * HOURS)
    k = interpolate(MODEL['enterprise']['anchors'], date)
    seats = k['unique_seats'] * k['active_fraction'] * k['accepted_noncoding_minutes_per_workday'] * 240 / (60 * HOURS)
    api = k['standalone_task_attempts_per_day'] * k['accepted_fraction'] * k['human_minutes_per_task'] * 365 / (60 * HOURS)
    enterprise_research = seats * MODEL['enterprise']['seat_research_share'] + api * MODEL['enterprise']['api_research_share']
    research += enterprise_research
    c = interpolate(MODEL['coding']['anchors'], date)
    coding = (c['assistant_only_weekly_users'] * c['assistant_accepted_hours_per_week'] + c['agent_weekly_users'] * c['agent_accepted_hours_per_week']) * 48 / HOURS
    a = interpolate(MODEL['driving']['anchors'], date)
    driving = sum(a.values()) * MODEL['driving']['passenger_hours_per_trip'] * MODEL['driving']['reposition_factor'] * MODEL['driving']['autonomous_task_fraction'] * 52 / HOURS
    r = interpolate(MODEL['robots']['anchors'], date)
    robot_parts = {g['key']: r[g['key']] * g['productive_hours_per_deployed_unit_per_year'] * g['human_hours_per_robot_hour'] / HOURS for g in MODEL['robots']['groups']}
    return [chat, research, seats + api - enterprise_research, coding, driving, sum(robot_parts.values())], {'enterprise_seats': seats, 'enterprise_api': api, 'robots': robot_parts}

def dates():
    result = []
    for year in range(2022, 2027):
        for month in range(1, 13):
            date = dt.date(year, month, calendar.monthrange(year, month)[1]).isoformat()
            if MODEL['start'] <= date < MODEL['as_of']:
                result.append(date)
    return result + [MODEL['as_of']]

path = DIR / 'digital-workforce.json'
data = json.loads(path.read_text())
# Read the current artifact and change only fields owned by this model.
data['title'] = 'Digital workforce'
data['note'] = 'Modeled annualized useful task output, in equivalents of 1,800 human task-hours/year. Not people, autonomous agents, jobs displaced, or measured net time saved. Robots include commercial mobile/service automation predating generative AI; exclude conventional fixed arms and household robots. Monthly inputs are interpolated, not observed. September 2026 is a nowcast. Model and primary sources: digital-workforce-methodology.html.'
data['dates'] = dates()
for i, series in enumerate(data['series']):
    series['values'] = [round(estimate(date)[0][i], 3) for date in data['dates']]
data.pop('codingModel', None)
data['model'] = {'version': MODEL['version'], 'asOf': MODEL['as_of'], 'inputs': 'digital-workforce-model.json', 'methodology': 'digital-workforce-methodology.html', 'generator': 'scripts/build-digital-workforce.py', 'interpolation': 'Linear interpolation of activity inputs, then evaluate each formula.'}
assert len(data['dates']) == 47 and len(set(data['dates'])) == 47
assert data['dates'] == sorted(data['dates'])
for s in data['series']:
    assert len(s['values']) == 47 and all(math.isfinite(v) and v >= 0 for v in s['values'])
for row in MODEL['consumer']['anchors']:
    assert abs(row['general_share'] + row['research_share'] - .9) < 1e-9, 'Reserve 10% for coding, counted separately'
for row in MODEL['coding']['anchors']:
    assert row['assistant_only_weekly_users'] + row['agent_weekly_users'] <= 40_000_000
content = json.dumps(data, indent=2) + '\n'
if '--check' in sys.argv:
    assert path.read_text() == content, 'Regenerate digital-workforce.json'
else:
    path.write_text(content)
for date in ['2022-11-30', '2023-11-30', '2024-12-31', '2025-12-31', MODEL['as_of']]:
    values, parts = estimate(date)
    print(date, ', '.join(f'{s["name"]}: {v:,.0f}' for s, v in zip(data['series'], values)), f'Total: {sum(values):,.0f}')
print('Latest components:', json.dumps(estimate(MODEL['as_of'])[1]))
