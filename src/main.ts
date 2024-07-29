import { launchInstance, createKeyPair, securityGroupExists, createSecurityGroup } from './launchInstance';
import readlineSync from 'readline-sync';

const main = async () => {
  try {
    const instanceName = readlineSync.question('Enter the EC2 instance name: ');
    const keyNameInput = readlineSync.question('Do you want to use an existing key pair? (yes/no): ');
    let keyName: string;

    if (keyNameInput.toLowerCase() === 'yes') {
      keyName = readlineSync.question('Enter the existing key pair name: ');
    } else {
      keyName = await createKeyPair(readlineSync.question('Enter the new key pair name: ')) || '';
    }

    const useExistingSecurityGroup = readlineSync.question('Do you want to use an existing security group? (yes/no): ');
    let securityGroupId: string | null | undefined;

    if (useExistingSecurityGroup.toLowerCase() === 'yes') {
      const existingGroupName = readlineSync.question('Enter the existing security group name: ');
      securityGroupId = await securityGroupExists(existingGroupName);
      if (!securityGroupId) {
        console.error('Security group not found.');
        return;
      }
    } else {
      const securityGroupName = readlineSync.question('Enter the new security group name: ');
      securityGroupId = await createSecurityGroup(securityGroupName) || null;
    }

    const volumeSize = parseInt(readlineSync.question('Enter the volume size (in GB): '), 10);

    console.log("Instance Name:", instanceName);
    console.log("Key Pair:", keyName);
    console.log("Security Group:", securityGroupId);

    await launchInstance(instanceName, keyName, securityGroupId || '', volumeSize);
  } catch (error) {
    console.error("Error configuring AWS SDK client:", error);
  }
};

main();
