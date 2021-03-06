import * as React from 'react';

import { View } from 'react-native';
import { useFormState, Form } from '../../src/index';
import { Button, HelperText, TextInput } from 'react-native-paper';

export default function App() {
  const [
    { errors, submit, formProps, hasError, setField },
    { email, telephone, password },
  ] = useFormState(
    {
      email: '',
      telephone: '',
      password: '',
      nested: {
        objectProperty: '',
      },
    },
    {
      onChange: () => {
        // TODO: fix enum in backend
      },
      onSubmit: () => {
        console.log('no errors, submit!');
        // alert('no errors we can submit');
      },
    }
  );

  return (
    <View
      style={{
        flex: 1,
        maxWidth: 500,
        alignSelf: 'center',
      }}
    >
      <Form {...formProps}>
        <TextInput
          mode="outlined"
          error={hasError('email')}
          {...email('email', {
            validate: (v: any) => {
              return looksLikeMail(v) ? true : 'Email-address is invalid';
            },
          })}
          label="E-mail"
        />
        <HelperText type="error" visible={hasError('email')}>
          {errors.email}
        </HelperText>
        <TextInput
          mode="outlined"
          {...telephone('telephone', {
            validate: (v: any) => {
              return looksLikeTelephone(v) ? true : 'Telephone is invalid';
            },
          })}
          label="Telefoon"
          error={hasError('telephone')}
        />
        <HelperText type="error" visible={hasError('telephone')}>
          {errors.telephone}
        </HelperText>

        <TextInput
          mode="outlined"
          {...password('password', {
            required: true,
            minLength: 3,
            maxLength: 10,
          })}
          label="Wachtwoord"
          error={hasError('password')}
        />
        <HelperText type="error" visible={hasError('password')}>
          {errors.password}
        </HelperText>
        <TextInput
          mode="outlined"
          error={hasError('nested.objectProperty' as any)}
          label="Nested objectProperty"
          onChange={(e: any) => {
            const value = e.target.value;
            setField('nested.objectProperty' as any, value);
          }}
        />
        <Button mode="contained" onPress={submit}>
          Save
        </Button>
      </Form>
    </View>
  );
}

function looksLikeTelephone(str: string): boolean {
  if (str.length !== 10) {
    return false;
  }
  let isNum = /^\d+$/.test(str);
  if (!isNum) {
    return false;
  }
  return true;
}

function looksLikeMail(str: string): boolean {
  let lastAtPos = str.lastIndexOf('@');
  let lastDotPos = str.lastIndexOf('.');
  return (
    lastAtPos < lastDotPos &&
    lastAtPos > 0 &&
    str.indexOf('@@') === -1 &&
    lastDotPos > 2 &&
    str.length - lastDotPos > 2
  );
}
