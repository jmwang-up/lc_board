import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

it('navigates among the three first-release pages', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: '算法看板' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: '题目记录' }));
  expect(screen.getByRole('heading', { name: '题目记录' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: '数据管理' }));
  expect(screen.getByRole('heading', { name: '数据管理' })).toBeInTheDocument();
  expect(screen.getByTestId('record-practice')).toBeInTheDocument();
});
