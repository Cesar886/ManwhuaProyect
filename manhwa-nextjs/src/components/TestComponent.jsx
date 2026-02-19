import { TextInput, PasswordInput, Button } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

export default function TestComponent() {
  return (
    <div>
      <h1>Test Components</h1>
      {/* <Drawer opened={false}></Drawer> */}
      <TextInput />
      <PasswordInput />
      <Button>Test</Button>
      <IconX size={24} />
    </div>
  );
}